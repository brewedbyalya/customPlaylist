const mongoose = require('mongoose');
const { Schema } = mongoose; 

const playlistSchema = new Schema({  
  title: { type: String, required: true },
  description: String,
  coverImage: {
        url: { type: String },
        cloudinary_id:{ type: String }
      },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  songs: [{ type: Schema.Types.ObjectId, ref: 'Song' }],
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);