require('dotenv').config({ quiet: true });
const express = require('express');
const app = express();
const methodOverride = require('method-override');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');

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
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Controllers
const authController = require('./controllers/authController');
const playlistController = require('./controllers/playlistController');
const songController = require('./controllers/songController');
const spotifyController = require('./controllers/spotifyController');
const passUserToView = require('./middleware/pass-user-to-view');

app.use(passUserToView);

// View Engine
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
      user: req.user
    });
  } catch (error) {
    console.error(error);
    res.render('index', { 
      playlists: [],
      user: req.user
    });
  }
});

app.use('/auth', authController);
app.use('/playlists', playlistController);
app.use('/songs', songController);
app.use('/spotify', spotifyController);

// Server
const port = process.env.PORT ? process.env.PORT : "3000"
app.listen(port, process.env.HOST, () => {
    console.log(`The express app is ready on port ${port}`);
});