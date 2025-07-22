const SpotifyStrategy = require('passport-spotify').Strategy;
const User = require('../models/user');

module.exports = (passport) => {
  passport.use(new SpotifyStrategy({
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_REDIRECT_URI,
      passReqToCallback: true,
      scope: ['user-read-email', 'user-read-private'],
      showDialog: true,
      proxy: true
    },
    async (req, accessToken, refreshToken, expires_in, profile, done) => {
      try {
        let user;
        if (req.user) {
          user = req.user;
          user.spotifyId = profile.id;
          user.spotifyAccessToken = accessToken;
          user.spotifyRefreshToken = refreshToken;
          await user.save();
          return done(null, user);
        }

        user = await User.findOne({ spotifyId: profile.id });

        if (!user) {
          user = new User({
            username: profile.displayName || `spotify_${profile.id}`,
            spotifyId: profile.id,
            spotifyAccessToken: accessToken,
            spotifyRefreshToken: refreshToken,
            email: profile.emails?.[0]?.value || null
          });
        } else {
          user.spotifyAccessToken = accessToken;
          user.spotifyRefreshToken = refreshToken;
        }

        await user.save();
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};