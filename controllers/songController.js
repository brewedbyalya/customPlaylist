const express = require('express');
const router = express.Router();
const Song = require('../models/song');
const Playlist = require('../models/playlist');
const isSignedIn = require('../middleware/is-signed-in');

// new - get
router.get('/new', isSignedIn, async (req, res) => {
  try {
    const playlists = await Playlist.find({ createdBy: req.session.user._id });
    res.render('songs/new', { playlists });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// new - post
router.post('/', isSignedIn, async (req, res) => {
  try {
    req.body.addedBy = req.session.user._id;
    const newSong = await Song.create(req.body);
    
    // song to playlist
    if (req.body.playlists) {
      const playlists = Array.isArray(req.body.playlists) ? req.body.playlists : [req.body.playlists];
      
      await Promise.all([
        Playlist.updateMany(
          { _id: { $in: playlists } },
          { $addToSet: { songs: newSong._id } }
        ),
        
        Song.findByIdAndUpdate(
          newSong._id,
          { $addToSet: { playlists: { $each: playlists } } }
        )
      ]);
    }
    
    res.redirect(`/songs/${newSong._id}`);
  } catch (error) {
    console.error(error);
    res.render('songs/new', { error: 'Failed to create song' });
  }
});

// show
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('addedBy')
      .populate('playlists');
    
    if (!song) {
      return res.redirect('/');
    }
    
    res.render('songs/show', { song });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// edit - get
router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    const playlists = await Playlist.find({ createdBy: req.session.user._id });
    
    if (!song) {
      return res.redirect('/');
    }
    
    if (song.addedBy.toString() !== req.session.user._id) {
      return res.redirect('/');
    }
    
    res.render('songs/edit', { song, playlists });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// edit - put
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.redirect('/');
    }
    
    if (song.addedBy.toString() !== req.session.user._id) {
      return res.redirect('/');
    }
    
    await Song.findByIdAndUpdate(req.params.id, req.body);

    res.redirect(`/songs/${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// delete
router.delete('/:id', isSignedIn, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.redirect('/');
    }
    
    if (song.addedBy.toString() !== req.session.user._id) {
      return res.redirect('/');
    }
    
    // delete from playlist
    await Playlist.updateMany(
      { songs: req.params.id },
      { $pull: { songs: req.params.id } }
    );
    
    await Song.findByIdAndDelete(req.params.id);
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

module.exports = router;