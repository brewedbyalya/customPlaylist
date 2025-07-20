const express = require('express');
const router = express.Router();
const Song = require('../models/song');
const Playlist = require('../models/playlist');
const User = require('../models/user');
const isSignedIn = require('../middleware/is-signed-in');

// index
router.get('/', async (req, res) => {
  try {
    const songs = await Song.find({}).populate('addedBy').populate('playlists');
    res.render('songs/index', { songs });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// new - get
router.get('/new', isSignedIn, (req, res) => {
  res.render('songs/new');
});

// new - post
router.post('/', isSignedIn, async (req, res) => {
  try {
    req.body.addedBy = req.session.user._id;
    const newSong = await Song.create(req.body);
    res.redirect(`/songs/${newSong._id}`);
  } catch (error) {
    console.error(error);
    res.render('songs/new', { error: 'Failed to add song' });
  }
});

// show
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('addedBy')
      .populate('playlists');
    
    if (!song) {
      return res.redirect('/songs');
    }

    let userPlaylists = [];
    if (req.session.user) {
      userPlaylists = await Playlist.find({ 
        createdBy: req.session.user._id 
      });
    }

    res.render('songs/show', { song, userPlaylists });
  } catch (error) {
    console.error(error);
    res.redirect('/songs');
  }
});

// edit - get
router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.redirect('/songs');
    }

    if (song.addedBy.toString() !== req.session.user._id) {
      return res.redirect('/songs');
    }

    res.render('songs/edit', { song });
  } catch (error) {
    console.error(error);
    res.redirect('/songs');
  }
});

// edit - post
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.redirect('/songs');
    }

    if (song.addedBy.toString() !== req.session.user._id) {
      return res.redirect('/songs');
    }

    await Song.findByIdAndUpdate(req.params.id, req.body);
    res.redirect(`/songs/${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.redirect('/songs');
  }
});

// delete - remove song
router.delete('/:id', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.redirect('/songs');
    }

    if (song.addedBy.toString() !== req.session.user._id) {
      return res.redirect('/songs');
    }

// delete - remove from all playlists
    await Playlist.updateMany(
      { songs: req.params.id },
      { $pull: { songs: req.params.id } }
    );

    await Song.findByIdAndDelete(req.params.id);
    res.redirect('/songs');
  } catch (error) {
    console.error(error);
    res.redirect('/songs');
  }
});

// song added to playlist
router.post('/:id/playlists', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    const playlist = await Playlist.findById(req.body.playlistId);
    
    if (!song || !playlist) {
      return res.redirect('/songs');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/songs');
    }

    if (playlist.songs.includes(song._id)) {
      return res.redirect(`/songs/${song._id}`);
    }

    playlist.songs.push(song._id);
    await playlist.save();

    if (!song.playlists.includes(playlist._id)) {
      song.playlists.push(playlist._id);
      await song.save();
    }

    res.redirect(`/songs/${song._id}`);
  } catch (error) {
    console.error(error);
    res.redirect('/songs');
  }
});

// delete - remove song from playlits
router.delete('/:id/playlists/:playlistId', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    const playlist = await Playlist.findById(req.params.playlistId);
    
    if (!song || !playlist) {
      return res.redirect('/songs');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/songs');
    }

    playlist.songs = playlist.songs.filter(
      songId => songId.toString() !== req.params.id
    );
    await playlist.save();

    song.playlists = song.playlists.filter(
      playlistId => playlistId.toString() !== req.params.playlistId
    );
    await song.save();

    res.redirect(`/songs/${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.redirect('/songs');
  }
});

module.exports = router;