const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { URLSearchParams } = require('url');
const User = require('../models/user');
const Playlist = require('../models/playlist');
const { isSignedIn } = require('../middleware/is-signed-in');
const crypto = require('crypto');
const fetch = require('node-fetch');

// generate random string
const generateRandomString = (length) => {
  return crypto.randomBytes(Math.ceil(length/2))
    .toString('hex')
    .slice(0, length);
};

// signup - get
router.get('/sign-up', (req, res) => {
  res.render('auth/sign-up', { 
    user: req.session.user,
    error: null
  });
});

// signup - post
router.post('/sign-up', async (req, res) => {
  try {
    const existingUser = await User.findOne({ 
      $or: [
        { username: req.body.username },
        { email: req.body.email }
      ]
    });
    
    if (existingUser) {
      let errorMessage = 'Username already taken';
      if (existingUser.email === req.body.email) {
        errorMessage = 'Email already registered';
      }
      return res.render('auth/sign-up', { 
        error: errorMessage,
        user: req.session.user
      });
    }

    if (req.body.password !== req.body.confirmPassword) {
      return res.render('auth/sign-up', { 
        error: 'Password and confirm password must match',
        user: req.session.user
      });
    }

    if (!req.body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.render('auth/sign-up', {
        error: 'Please provide a valid email address',
        user: req.session.user
      });
    }

    const hashedPassword = bcrypt.hashSync(req.body.password, 10);
    const newUser = await User.create({
      email: req.body.email,
      username: req.body.username,
      password: hashedPassword
    });

    req.session.user = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email
    };

    res.redirect('/');
  } catch (error) {
    console.error('Sign-up error:', error);
    res.render('auth/sign-up', { 
      error: 'Failed to create account. Please try again.',
      user: req.session.user
    });
  }
});

// signin - get
router.get('/sign-in', (req, res) => {
  res.render('auth/sign-in', { 
    user: req.session.user,
    error: req.query.error ? {
      'auth_failed': 'Spotify authentication failed',
      'state_mismatch': 'Security verification failed',
      'no_code': 'Missing authorization code',
      'token_exchange_failed': 'Failed to exchange tokens',
      'no_email': 'Spotify account email not found',
      'duplicate_account': 'Email already linked to another account'
    }[req.query.error] || 'Authentication failed' : null
  });
});

// signin - post
router.post('/sign-in', async (req, res) => {
  try {
    const userInDatabase = await User.findOne({
      $or: [
        { username: req.body.usernameOrEmail },
        { email: req.body.usernameOrEmail }
      ]
    });
    
    if (!userInDatabase) {
      return res.render('auth/sign-in', { 
        error: 'Login failed. Please try again.',
        user: req.session.user
      });
    }

    if (!userInDatabase.password && userInDatabase.spotifyId) {
      return res.render('auth/sign-in', {
        error: 'Please sign in with Spotify',
        user: req.session.user
      });
    }

    const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.password);
    if (!validPassword) {
      return res.render('auth/sign-in', { 
        error: 'Login failed. Please try again.',
        user: req.session.user
      });
    }

    req.session.user = {
      _id: userInDatabase._id,
      username: userInDatabase.username,
      email: userInDatabase.email
    };

    res.redirect('/');
  } catch (error) {
    console.error('Sign-in error:', error);
    res.render('auth/sign-in', { 
      error: 'Login failed. Please try again.',
      user: req.session.user
    });
  }
});

// sign out
router.get("/sign-out", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// spotify auth
router.get('/spotify', (req, res) => {
  const state = generateRandomString(16);
  req.session.spotifyAuthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: 'user-read-email user-read-private',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state: state,
    show_dialog: true
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// spotify callback
router.get('/spotify/callback', async (req, res) => {
  try {
    if (!req.query.state || req.query.state !== req.session.spotifyAuthState) {
      return res.redirect('/auth/sign-in?error=state_mismatch');
    }

    if (!req.query.code) {
      return res.redirect('/auth/sign-in?error=no_code');
    }

    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('code', req.query.code);
    tokenParams.append('redirect_uri', process.env.SPOTIFY_REDIRECT_URI);

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')
      },
      body: tokenParams
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return res.redirect('/auth/sign-in?error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;

    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch profile');
    }

   
    const profile = await profileResponse.json();
    
    if (!profile.email) {
      return res.redirect('/auth/sign-in?error=no_email');
    }

    const existingEmailUser = await User.findOne({ 
      email: profile.email,
      spotifyId: { $ne: profile.id }
    });
    
    if (existingEmailUser) {
      return res.redirect('/auth/sign-in?error=duplicate_account');
    }

    let user;
    if (req.session.user) {
      user = await User.findByIdAndUpdate(
        req.session.user._id,
        { 
          $set: {
            spotifyId: profile.id,
            spotifyAccessToken: access_token,
            spotifyRefreshToken: refresh_token
          }
        },
        { new: true }
      );
    } else {
      user = await User.findOneAndUpdate(
        { $or: [
          { email: profile.email },
          { spotifyId: profile.id }
        ]},
        {
          $set: {
            username: profile.display_name || `spotify_${profile.id.slice(0, 8)}`,
            email: profile.email,
            spotifyId: profile.id,
            spotifyAccessToken: access_token,
            spotifyRefreshToken: refresh_token
          },
          $setOnInsert: {
            password: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10),
            createdAt: new Date()
          }
        },
        { 
          upsert: true,
          new: true
        }
      );
    }

    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      spotifyId: user.spotifyId
    };

    res.redirect('/');
  } catch (error) {
    console.error('Spotify auth error:', error);
    if (error.code === 11000) {
      return res.redirect('/auth/sign-in?error=duplicate_account');
    }
    res.redirect('/auth/sign-in?error=auth_failed');
  }
});

module.exports = router;