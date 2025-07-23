const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Song = require('../models/song');
const Playlist = require('../models/playlist');
const { refreshSpotifyToken } = require('../utils/spotifyAuth');
const fetch = require('node-fetch');

async function makeSpotifyRequest(user, endpoint) {
  try {
    const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${user.spotifyAccessToken}`
      }
    });

    if (response.status === 401) {
      const newToken = await refreshSpotifyToken(user._id);
      if (!newToken) throw new Error('Token refresh failed');
      
      const retryResponse = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      });
      return await retryResponse.json();
    }

    return await response.json();
  } catch (error) {
    console.error('Spotify API error:', error);
    throw error;
  }
}

// Search route
router.get('/search', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user._id);
    if (!user || !user.spotifyAccessToken) {
      return res.redirect('/settings');
    }

    const searchTerm = req.query.q;
    const playlistId = req.query.playlistId;

    if (!searchTerm) {
      return res.render('spotify/search', {
        tracks: [],
        searchTerm: '',
        playlistId: playlistId || null,
        user: req.session.user
      });
    }

    const data = await makeSpotifyRequest(user, `search?q=${encodeURIComponent(searchTerm)}&type=track&limit=10`);
    
    const tracks = data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      duration: msToTime(track.duration_ms),
      album: track.album.name,
      image: track.album.images[0]?.url,
      spotifyLink: track.external_urls.spotify
    }));

    res.render('spotify/search', {
      tracks,
      searchTerm,
      playlistId: playlistId || null,
      user: req.session.user
    });

  } catch (error) {
    console.error('Search error:', error);
    res.render('spotify/search', {
      tracks: [],
      searchTerm: req.query.q || '',
      playlistId: req.query.playlistId || null,
      user: req.session.user,
      error: 'Search failed'
    });
  }
});

// Import route
router.post('/import', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send('Please sign in');
    }

    const user = await User.findById(req.session.user._id);
    if (!user || !user.spotifyAccessToken) {
      return res.status(403).send('Connect Spotify account first');
    }

    const { spotifyId, playlistId } = req.body;
    if (!spotifyId) {
      return res.status(400).send('Missing track ID');
    }

    const track = await makeSpotifyRequest(user, `tracks/${spotifyId}`);

    const newSong = await Song.create({
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      duration: msToTime(track.duration_ms),
      spotifyLink: track.external_urls.spotify,
      spotifyId: track.id,
      addedBy: user._id
    });

    if (playlistId) {
      await Playlist.findByIdAndUpdate(playlistId, {
        $addToSet: { songs: newSong._id }
      });
      return res.redirect(`/playlists/${playlistId}/edit`);
    }

    res.redirect(`/songs/${newSong._id}`);

  } catch (error) {
    console.error('Import error:', error);
    res.redirect(req.body.playlistId 
      ? `/playlists/${req.body.playlistId}/edit` 
      : '/spotify/search');
  }
});

function msToTime(duration) {
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

module.exports = router;