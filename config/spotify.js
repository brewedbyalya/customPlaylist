const SpotifyStrategy = require('passport-spotify').Strategy;
const User = require('../models/user');
const spotifyApi = require('./spotify-api');

passport.use(new SpotifyStrategy({
    clientID: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    callbackURL: process.env.SPOTIFY_REDIRECT_URI,
    passReqToCallback: true 
},
async (req, accessToken, refreshToken, expires_in, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email found with Spotify account'));

        let user;
        if (req.session.user) {
            user = await User.findByIdAndUpdate(
                req.session.user._id,
                {
                    spotifyId: profile.id,
                    spotifyAccessToken: accessToken,
                    spotifyRefreshToken: refreshToken
                },
                { new: true }
            );
        } else {
            user = await User.findOneAndUpdate(
                { $or: [{ email }, { spotifyId: profile.id }] },
                {
                    username: profile.display_name || `spotify_${profile.id.slice(0, 8)}`,
                    email,
                    spotifyId: profile.id,
                    spotifyAccessToken: accessToken,
                    spotifyRefreshToken: refreshToken
                },
                { upsert: true, new: true }
            );
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));