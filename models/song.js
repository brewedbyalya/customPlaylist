const mongoose = require('mongoose');
const { Schema } = mongoose; 

const songSchema = new Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  duration: String,
genre: {
    type: String,
    enum: [
      'Pop',
      'Rock',
      'Hip-Hop',
      'R&B',
      'Electronic',
      'Jazz',
      'Classical',
      'Country',
      'Metal',
      'Alternative',
      'Indie',
      'Other'
    ]
  },  
  spotifyLink: String,
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  playlists: [{ type: Schema.Types.ObjectId, ref: 'Playlist' }],
  playlistId: String,
}, { timestamps: true });

const Song = mongoose.model('Song', songSchema);
module.exports = Song;