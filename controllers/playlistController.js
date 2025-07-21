const express = require('express');
const router = express.Router();
const Playlist = require('../models/playlist');
const Song = require('../models/song');
const User = require('../models/user');
const isSignedIn = require('../middleware/is-signed-in');
const upload = require('../config/multer');
const cloudinary = require('../config/cloudinary');

// index
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const [playlists, count] = await Promise.all([
    Playlist.find({ isPublic: true })
      .skip(skip)
      .limit(limit)
      .populate('createdBy')
      .populate('songs'),
    Playlist.countDocuments({ isPublic: true })
  ]);

  res.render('playlists/index', { 
    playlists,
    currentPage: page,
    totalPages: Math.ceil(count / limit),
    user: req.session.user // Added user to view
  });
});

// new - get
router.get('/new', isSignedIn, (req, res) => {
  res.render('playlists/new', { 
    user: req.session.user // Added user to view
  });
});

// new - post
router.post('/', isSignedIn, upload.single('coverImage'), async (req, res) => {
  try {
    req.body.createdBy = req.session.user._id;
    req.body.image = {
      url: req.file.path,
      cloudinary_id: req.file.fieldname
    }
    const newPlaylist = await Playlist.create(req.body);
    res.redirect(`/playlists/${newPlaylist._id}`);
  } catch (error) {
    console.error(error);
    res.render('playlists/new', { 
      error: 'Failed to create playlist',
      user: req.session.user // Added user to view
    });
  }
});

// show
router.get('/:id', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('createdBy')
      .populate('songs');
    
    if (!playlist) {
      return res.redirect('/playlists');
    }

    if (!playlist.isPublic && (!req.session.user || playlist.createdBy._id.toString() !== req.session.user._id)) {
      return res.redirect('/playlists');
    }

    res.render('playlists/show', { 
      playlist,
      user: req.session.user // Added user to view
    });
  } catch (error) {
    console.error(error);
    res.redirect('/playlists');
  }
});

// edit
router.get('/:id/edit', isSignedIn, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.redirect('/playlists');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/playlists');
    }

    const songs = await Song.find({});
    res.render('playlists/edit', { 
      playlist, 
      songs,
      user: req.session.user // Added user to view
    });
  } catch (error) {
    console.error(error);
    res.redirect('/playlists');
  }
});

// update
router.put('/:id', isSignedIn, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.redirect('/playlists');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/playlists');
    }

    await Playlist.findByIdAndUpdate(req.params.id, req.body);
    res.redirect(`/playlists/${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.redirect('/playlists');
  }
});

// delete - remove playlist
router.delete('/:id', isSignedIn, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.redirect('/playlists');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/playlists');
    }

    await Song.updateMany(
      { playlists: req.params.id },
      { $pull: { playlists: req.params.id } }
    );

    await Playlist.findByIdAndDelete(req.params.id);
    res.redirect('/playlists');
  } catch (error) {
    console.error(error);
    res.redirect('/playlists');
  }
});

// new - song to playlist
router.post('/:id/songs', isSignedIn, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.redirect('/playlists');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/playlists');
    }

    if (playlist.songs.includes(req.body.songId)) {
      return res.redirect(`/playlists/${req.params.id}/edit`);
    }

    playlist.songs.push(req.body.songId);
    await playlist.save();

    const song = await Song.findById(req.body.songId);
    if (song) {
      song.playlists.push(playlist._id);
      await song.save();
    }

    res.redirect(`/playlists/${req.params.id}/edit`);
  } catch (error) {
    console.error(error);
    res.redirect('/playlists');
  }
});

// delete - remove song from playlist
router.delete('/:id/songs/:songId', isSignedIn, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.redirect('/playlists');
    }

    if (playlist.createdBy.toString() !== req.session.user._id) {
      return res.redirect('/playlists');
    }

    playlist.songs = playlist.songs.filter(
      songId => songId.toString() !== req.params.songId
    );
    await playlist.save();

    await Song.findByIdAndUpdate(
      req.params.songId,
      { $pull: { playlists: req.params.id } }
    );

    res.redirect(`/playlists/${req.params.id}/edit`);
  } catch (error) {
    console.error(error);
    res.redirect('/playlists');
  }
});

module.exports = router;