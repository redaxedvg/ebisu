// src/models/Tweet.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Tweet Schema - Tracks Twitter interactions for rewards
 */
const tweetSchema = new mongoose.Schema({
  // Core tweet data
  tweetId: { 
    type: String, 
    required: true,
    unique: true,
    index: true 
  },
  postedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  // Interaction tracking
  finalChecked: { 
    type: Boolean, 
    default: false,
    index: true
  },
  discordMessageId: { 
    type: String, 
    default: null 
  },
  
  // User interaction arrays
  likedUserIds: { 
    type: [String], 
    default: [] 
  },
  retweetedUserIds: { 
    type: [String], 
    default: [] 
  },
  rewardedForLikes: { 
    type: [String], 
    default: [] 
  },
  rewardedForRetweets: { 
    type: [String], 
    default: [] 
  },
  
  // Additional metadata
  content: {
    type: String,
    default: ''
  },
  mediaUrls: {
    type: [String],
    default: []
  },
  authorUsername: {
    type: String,
    default: ''
  },
  
  // Tracking changes
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastInteractionCheck: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// For finding tweets that need final checks
tweetSchema.index({ postedAt: 1, finalChecked: 1 });

// For finding recent tweets by a specific user
tweetSchema.index({ authorUsername: 1, postedAt: -1 });

/**
 * Get pending rewards for a tweet
 * @returns {Object} Counts of pending rewards
 */
tweetSchema.methods.getPendingRewards = function() {
  // Find users who liked but haven't been rewarded
  const pendingLikes = this.likedUserIds.filter(
    userId => !this.rewardedForLikes.includes(userId)
  );
  
  // Find users who retweeted but haven't been rewarded
  const pendingRetweets = this.retweetedUserIds.filter(
    userId => !this.rewardedForRetweets.includes(userId)
  );
  
  return {
    pendingLikes: pendingLikes.length,
    pendingRetweets: pendingRetweets.length,
    total: pendingLikes.length + pendingRetweets.length
  };
};

/**
 * Mark tweet as checked after final interactions check
 */
tweetSchema.methods.markAsFinalChecked = function() {
  this.finalChecked = true;
  this.lastInteractionCheck = new Date();
  return this.save();
};

/**
 * Find tweets that need final checking
 */
tweetSchema.statics.findPendingFinalChecks = function(hoursOld = 48, limit = 10) {
  const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  
  return this.find({
    postedAt: { $lte: cutoffDate },
    finalChecked: { $ne: true }
  }).limit(limit);
};

/**
 * Find recent tweets by username
 */
tweetSchema.statics.findByUsername = function(username, limit = 10) {
  return this.find({ 
    authorUsername: username 
  })
  .sort({ postedAt: -1 })
  .limit(limit);
};

/**
 * Pre-save hook to log large interaction changes
 */
tweetSchema.pre('save', function(next) {
  const tweet = this;
  
  // Skip for new tweets
  if (tweet.isNew) {
    return next();
  }
  
  // Track if any substantial changes occurred
  const hasSubstantialChanges = 
    tweet.isModified('likedUserIds') && 
    tweet.likedUserIds.length > tweet._oldLikedCount + 10;
  
  // Log substantial changes  
  if (hasSubstantialChanges) {
    logger.info('Substantial tweet interaction changes', {
      tweetId: tweet.tweetId,
      oldLikeCount: tweet._oldLikedCount || 0,
      newLikeCount: tweet.likedUserIds.length,
      oldRetweetCount: tweet._oldRetweetCount || 0,
      newRetweetCount: tweet.retweetedUserIds.length
    });
  }
  
  next();
});

/**
 * Query middleware to track loaded interaction counts
 */
tweetSchema.post('findOne', function(doc) {
  if (doc) {
    doc._oldLikedCount = doc.likedUserIds.length;
    doc._oldRetweetCount = doc.retweetedUserIds.length;
  }
});

module.exports = mongoose.model('Tweet', tweetSchema);