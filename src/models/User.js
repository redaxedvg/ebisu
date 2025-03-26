// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: { type: String, unique: true, index: true },
  username: String,
  messagesCount: { type: Number, default: 0 },
  reactionsCount: { type: Number, default: 0 },
  voiceMinutes: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  lastDaily: { type: Date, default: null },
  twitterId: { type: String, default: null },
  twitterUsername: { type: String, default: null },
  totalLikes: { type: Number, default: 0 },
  totalRetweets: { type: Number, default: 0 },
  rewardedRoles: { type: [String], default: [] },
});

module.exports = mongoose.model('User', userSchema);