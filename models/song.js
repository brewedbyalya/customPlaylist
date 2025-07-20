const mongoose = require('mongoose');
const { Schema } = mongoose; 

const songSchema = new Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  duration: String,
  genre: String,
  spotifyLink: String,
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  playlists: [{ type: Schema.Types.ObjectId, ref: 'Playlist' }],
}, { timestamps: true });

const Song = mongoose.model('Song', songSchema);
module.exports = Song;