const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const passport = require('passport');
const { isSignedIn } = require('../middleware/is-signed-in');
const LocalStrategy = require('passport-local').Strategy;

// Signup - GET
router.get('/sign-up', (req, res) => {
    res.render('auth/sign-up', { 
        user: req.user 
    });
});

// Signup - POST
router.post('/sign-up', async (req, res, next) => {
    try {
        const userInDatabase = await User.findOne({ username: req.body.username });
        if (userInDatabase) {
            return res.render('auth/sign-up', { 
                error: 'Username already taken',
                user: req.user
            });
        }

        if (req.body.password !== req.body.confirmPassword) {
            return res.render('auth/sign-up', { 
                error: 'Password and confirm password must match',
                user: req.user
            });
        }

        const hashedPassword = bcrypt.hashSync(req.body.password, 10);
        const newUser = await User.create({
            username: req.body.username,
            password: hashedPassword
        });

        // Use Passport's login method
        req.login(newUser, (err) => {
            if (err) return next(err);
            return res.redirect('/');
        });

    } catch (error) {
        console.error(error);
        res.render('auth/sign-up', { 
            error: 'Failed to create account',
            user: req.user
        });
    }
});

// Signin - GET
router.get('/sign-in', (req, res) => {
    res.render('auth/sign-in', { 
        user: req.user 
    });
});

// Signin - POST
router.post('/sign-in', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.render('auth/sign-in', { 
                error: info.message,
                user: req.user
            });
        }
        req.login(user, (err) => {
            if (err) return next(err);
            return res.redirect('/');
        });
    })(req, res, next);
});

// Signout
router.get("/sign-out", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect("/");
    });
});

// Spotify Auth - GET
router.get('/spotify', (req, res, next) => {
    const state = req.user ? req.user.id : null;
    passport.authenticate('spotify', {
        scope: ['user-read-email', 'user-read-private'],
        state: JSON.stringify(state)
    })(req, res, next);
});

// Spotify Callback
router.get('/spotify/callback',
    passport.authenticate('spotify', { 
        failureRedirect: '/auth/sign-in',
        failureFlash: 'Failed to authenticate with Spotify'
    }),
    (req, res) => {
        res.redirect('/');
    }
);

passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = await User.findOne({ username });
            if (!user) {
                return done(null, false, { message: 'Incorrect username' });
            }
            if (!bcrypt.compareSync(password, user.password)) {
                return done(null, false, { message: 'Incorrect password' });
            }
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

module.exports = router;