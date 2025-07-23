const express = require('express');
const router = express.Router();
const Playlist = require('../models/playlist');
const Song = require('../models/song');
const User = require('../models/user');
const isSignedIn = require('../middleware/is-signed-in');
const upload = require('../config/multer');
const cloudinary = require('../config/cloudinary');

// index + search
router.get('/', async (req, res) => {
  try {
    const { search, filter, sort } = req.query;
    
    let query = {};
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    if (filter === 'public') {
      query.isPublic = true;
    } else if (filter === 'private') {
      query.isPublic = false;
    }
    
    let sortOption = { createdAt: -1 }; 
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }
    
    let userPlaylists = [];
    if (req.session.user) {
      userPlaylists = await Playlist.find({ 
        ...query,
        createdBy: req.session.user._id 
      })
      .populate('createdBy', 'username')
      .populate('songs')
      .sort(sortOption);
    }
    
    const publicQuery = { ...query, isPublic: true };
    const publicPlaylists = await Playlist.find(publicQuery)
      .populate('createdBy', 'username')
      .populate('songs')
      .sort(sortOption)
      .limit(req.session.user ? 12 : 6);

    res.render('playlists/index', {
      userPlaylists,
      publicPlaylists,
      user: req.session.user,
      searchQuery: search || '',
      filter: filter || '',
      sort: sort || 'newest'
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Failed to load playlists');
    res.render('playlists/index', {
      userPlaylists: [],
      publicPlaylists: [],
      user: req.session.user,
      searchQuery: '',
      filter: '',
      sort: 'newest'
    });
  }
});


// new - get
router.get('/new', isSignedIn, (req, res) => {
  res.render('playlists/new', { 
    user: req.session.user
  });
});

// new - post
router.post('/', isSignedIn, upload.single('coverImage'), async (req, res) => {
  try {
    req.body.createdBy = req.session.user._id;    
    if (req.file) {
      req.body.image = {
        url: req.file.path,
        cloudinary_id: req.file.filename
      };
    }
      console.log(req.body);
      console.log(req.session);
    const newPlaylist = await Playlist.create(req.body);
    res.redirect(`/playlists/${newPlaylist._id}`);
  } catch (error) {
    console.error('Upload error:', error);
    res.render('playlists/new', { 
      error: 'Failed to upload image',
      user: req.session.user
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
      user: req.session.user
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
      user: req.session.user
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