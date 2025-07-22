const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: function() { return !this.spotifyId; }
  },
  spotifyId: {
    type: String,
    unique: true,
    sparse: true
  },
  spotifyAccessToken: String,
  spotifyRefreshToken: String,
  email: String
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;