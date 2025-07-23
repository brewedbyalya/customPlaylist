const express = require('express');
const router = express.Router();
const Song = require('../models/song');
const Playlist = require('../models/playlist');
const User = require('../models/user');
const isSignedIn = require('../middleware/is-signed-in');

// index 
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || '';
    const sortBy = req.query.sort || '';

    let query = {};
    let sortOption = { createdAt: -1 };

    if (searchQuery) {
      query = {
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { artist: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    if (sortBy === 'title') {
      sortOption = { title: 1 };
    } else if (sortBy === 'artist') {
      sortOption = { artist: 1 };
    } else if (sortBy === 'newest') {
      sortOption = { createdAt: -1 };
    }

    const [songs, count] = await Promise.all([
      Song.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortOption)
        .populate('addedBy')
        .populate('playlists'),
      Song.countDocuments(query)
    ]);

    res.render('songs/index', {
      songs, currentPage: page, totalPages: Math.ceil(count / limit), searchQuery, sortBy, user: req.session.user
    });
  } 
  
  catch (error) {
    console.error(error);
    res.render('songs/index', {
      songs: [],
      error: 'Failed to load songs'});
  }
});

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