const express = require('express');
const router = express.Router();
const Song = require('../models/song');
const User = require('../models/user');
const createSpotifyApi = require('../config/spotify-api');

// Search Spotify
router.get('/search', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/auth/sign-in');
    }

    const user = await User.findById(req.session.user._id);
    if (!user.spotifyAccessToken) {
      return res.redirect('/auth/spotify');
    }

    const spotifyApi = await createSpotifyApi(user);
    const { q } = req.query;

    if (!q) {
      return res.render('spotify/search', { 
        tracks: [],
        user: req.session.user 
      });
    }

    const { body } = await spotifyApi.searchTracks(q, { limit: 10 });
    
    res.render('spotify/search', {
      tracks: body.tracks.items,
      query: q,
      user: req.session.user
    });
  } catch (error) {
    console.error('Spotify search error:', error);
    
    if (error.statusCode === 401) {
      return res.redirect('/auth/spotify');
    }
    
    res.render('error', { 
      error: 'Failed to search Spotify',
      user: req.session.user 
    });
  }
});

module.exports = router;