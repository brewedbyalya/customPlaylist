const User = require('../models/user');
const querystring = require('querystring');

async function refreshSpotifyToken(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.spotifyRefreshToken) return null;

    const postData = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: user.spotifyRefreshToken
    });

    const options = {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')
      }
    };

    const response = await fetch(options, postData);
    user.spotifyAccessToken = response.access_token;
    await user.save();
    return response.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

module.exports = { refreshSpotifyToken };