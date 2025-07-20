const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user.js');

router.get('/', (req, res) => {
    res.send('does the auth route work?');
});

// Signup - Get
router.get('/sign-up', (req, res) => {
    res.render('auth/sign-up.ejs');
});

// Signup - Post
router.post('/sign-up', async (req, res) => {

    console.log(req)
    const userInDatabase = await User.findOne({ username: req.body.username });
    if (userInDatabase) {
        return res.send('Username already taken.');
    }
    if (req.body.password !== req.body.confirmPassword) {
        return res.send('Password and confirm password must match.');
    }
    const hashedPassword = bcrypt.hashSync(req.body.password, 10)
    req.body.password = hashedPassword
    const newUser = await User.create(req.body);
    req.session.user = {
        username: newUser.username,
        _id: newUser._id,
    }
    
    req.session.save(() => {
        console.log(req.session);
        res.redirect('/');
    })
});

// Signin - Get
router.get('/sign-in', (req, res) => {
    res.render('auth/sign-in.ejs');
});

// Signin - Post
router.post('/sign-in', async (req, res) => {
    const userInDatabase = await User.findOne({ username: req.body.username });
    console.log(userInDatabase);
    if (!userInDatabase) {
        return res.send('Login failed. Please try again.');
    }
    const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.password)
    if(!validPassword) {
        return res.send('Login failed. Please try again.');
    }
    req.session.user = {
        username: userInDatabase.username,
        _id: userInDatabase._id,
    }
    req.session.save(() => {
        res.redirect('/');
    })
});

// Signout
router.get('/sign-out', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    })
});

module.exports = router;