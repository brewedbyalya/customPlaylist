const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  password: String,
  spotifyId: {
    type: String,
    unique: true,
    sparse: true
  },
  spotifyAccessToken: String,
  spotifyRefreshToken: String
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);