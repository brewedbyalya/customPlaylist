require('dotenv').config({ quiet: true });
const express = require('express');
const app = express();
const methodOverride = require('method-override');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const authController = require('./controllers/authController');
const isSignedIn = require('./middleware/is-signed-in');
const passUserToView = require('./middleware/pass-user-to-view');
const Playlist = require('./models/playlist');
const playlistController = require('./controllers/playlistController');
const songController = require('./controllers/songController');


// Database
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('connected', () => {
    console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
})

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(morgan('dev'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
    })
}));
app.use(passUserToView);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate('createdBy')
      .populate('songs')
      .limit(6);
    
    res.render('index', { 
      playlists,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.render('index', { 
      playlists: [],
      user: req.session.user 
    });
  }
});

app.use('/auth', authController);
app.use('/playlists', playlistController);
app.use('/songs', songController);

// Server
const port = process.env.PORT ? process.env.PORT : "3000"
app.listen(port, () => {
    console.log(`The express app is ready on port ${port}`);
});