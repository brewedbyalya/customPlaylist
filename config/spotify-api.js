const SpotifyWebApi = require('spotify-web-api-node');

const createSpotifyApi = (user) => { 
  if (!user || !user.spotifyAccessToken) {
    throw new Error('User not authenticated with Spotify');
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    accessToken: user.spotifyAccessToken,
    refreshToken: user.spotifyRefreshToken
  });

  return spotifyApi;
};

module.exports = createSpotifyApi;