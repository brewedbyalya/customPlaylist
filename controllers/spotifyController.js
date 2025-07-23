const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Song = require('../models/song');
const { refreshSpotifyToken } = require('../utils/spotifyAuth');
const fetch = require('node-fetch');

async function makeSpotifyRequest(user, endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${user.spotifyAccessToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    let response = await fetch(`https://api.spotify.com/v1/${endpoint}`, options);

    if (response.status === 401) {
      const newToken = await refreshSpotifyToken(user._id);
      if (!newToken) throw new Error('Token refresh failed');

      options.headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(`https://api.spotify.com/v1/${endpoint}`, options);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Spotify API request failed');
    }

    return response.json();
  } catch (error) {
    console.error('Spotify API error:', error);
    throw error;
  }
}

// Convert milliseconds to MM:SS format
function msToTime(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

// Search Spotify for tracks
router.get('/search', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).render('error', { 
        error: 'Please sign in to access Spotify features',
        user: null
      });
    }

    const user = await User.findById(req.session.user._id);
    if (!user || !user.spotifyAccessToken) {
      return res.status(403).render('error', {
        error: 'Please connect your Spotify account first',
        user: req.session.user
      });
    }

    const query = req.query.q;
    if (!query) {
      return res.render('spotify/search', { 
        tracks: [],
        user: req.session.user,
        error: null
      });
    }

    const data = await makeSpotifyRequest(user, `search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    
    const tracks = data.tracks.items.map(track => ({
      _id: track._id,
      name: track.name,
      artists: track.artists,
      duration_ms: track.duration_ms,
      album: track.album.name,
      image: track.album.images[0]?.url,
      spotifyLink: track.external_urls.spotify
    }));

    res.render('spotify/search', { 
      tracks,
      msToTime,
      query,
      user: req.session.user,
      error: null
    });

  } catch (error) {
    console.error('Spotify search error:', error);
    res.status(500).render('spotify/search', {
      tracks: [],
      user: req.session.user,
      error: 'Failed to search Spotify. Please try again.'
    });
  }
});

// Import track from Spotify
router.post('/import', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Please sign in to import tracks' });
    }

    const user = await User.findById(req.session.user._id);
    if (!user || !user.spotifyAccessToken) {
      return res.status(403).json({ error: 'Please connect your Spotify account first' });
    }

    const { spotifyId } = req.body;
    if (!spotifyId) {
      return res.status(400).json({ error: 'Missing track ID' });
    }

    const track = await makeSpotifyRequest(user, `tracks/${spotifyId}`);
    
    // Create the song
    const newSong = await Song.create({
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      duration: msToTime(track.duration_ms),
      spotifyLink: track.external_urls.spotify,
      spotifyId: track.id,
      createdBy: user.id
    });

    return res.json({ 
      success: true, 
      songId: newSong.id,
      redirectUrl: `/songs/${newSong.id}`
    });

  } catch (error) {
    console.error('Spotify import error:', error);
    return res.status(500).json({ 
      error: 'Failed to import track. Please try again.' 
    });
  }
});

module.exports = router;