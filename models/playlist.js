const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  coverImage: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  songs: [{ type: Schema.Types.ObjectId, ref: 'Song' }],
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

const Playlist = mongoose.model('Playlist', playlistSchema);
module.exports = Playlist;