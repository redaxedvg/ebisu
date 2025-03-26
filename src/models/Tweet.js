// src/models/Tweet.js
const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
  tweetId: { type: String, index: true },
  postedAt: { type: Date, default: Date.now },
  rewardedForLikes: { type: [String], default: [] },
  rewardedForRetweets: { type: [String], default: [] },
  likedUserIds: { type: [String], default: [] },
  retweetedUserIds: { type: [String], default: [] },
  finalChecked: { type: Boolean, default: false },
  discordMessageId: { type: String, default: null },
});

module.exports = mongoose.model('Tweet', tweetSchema);