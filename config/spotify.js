const SpotifyStrategy = require('passport-spotify').Strategy;
const User = require('../models/user');
const spotifyApi = require('./spotify-api');

module.exports = (passport) => {
  passport.use(new SpotifyStrategy({
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_REDIRECT_URI
    },
    async (accessToken, refreshToken, expires_in, profile, done) => {
      try {
        let user = await User.findOne({ spotifyId: profile.id });
        
        if (!user) {
          user = await User.findOneAndUpdate(
            { _id: req.session.user._id },
            { 
              spotifyId: profile.id,
              spotifyAccessToken: accessToken,
              spotifyRefreshToken: refreshToken
            },
            { new: true }
          );
        } else {
          user.spotifyAccessToken = accessToken;
          user.spotifyRefreshToken = refreshToken;
          await user.save();
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));
};