// src/models/User.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * User Schema - Stores user data and interactions
 */
const userSchema = new mongoose.Schema({
  // Core identifiers
  discordId: { 
    type: String, 
    required: true,
    unique: true, 
    index: true 
  },
  username: String,
  
  // Twitter integration
  twitterId: { 
    type: String, 
    default: null,
    index: true
  },
  twitterUsername: { 
    type: String, 
    default: null 
  },
  
  // Economy and rewards
  coins: { 
    type: Number, 
    default: 0,
    index: true 
  },
  lastDaily: { 
    type: Date, 
    default: null 
  },
  rewardedRoles: { 
    type: [String], 
    default: [] 
  },
  
  // Activity metrics
  messagesCount: { 
    type: Number, 
    default: 0,
    index: true 
  },
  reactionsCount: { 
    type: Number, 
    default: 0 
  },
  voiceMinutes: { 
    type: Number, 
    default: 0,
    index: true 
  },
  totalLikes: { 
    type: Number, 
    default: 0 
  },
  totalRetweets: { 
    type: Number, 
    default: 0 
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Compound indexes for optimized queries
userSchema.index({ twitterId: 1, discordId: 1 });
userSchema.index({ coins: -1, discordId: 1 });
userSchema.index({ messagesCount: -1, discordId: 1 });
userSchema.index({ voiceMinutes: -1, discordId: 1 });

/**
 * Pre-save hook to log significant coin changes
 */
userSchema.pre('save', function(next) {
  const user = this;
  
  // If this is a new user or coins haven't changed, continue
  if (user.isNew || !user.isModified('coins')) {
    return next();
  }
  
  // Get the original document if it exists
  if (user._previousCoins !== undefined) {
    const coinChange = user.coins - user._previousCoins;
    
    // Log significant coin changes
    if (Math.abs(coinChange) >= 100) {
      logger.info('Significant coin change detected', {
        userId: user.discordId,
        previousCoins: user._previousCoins,
        newCoins: user.coins,
        change: coinChange
      });
    }
  }
  
  next();
});

/**
 * Query middleware to track loaded coins value
 */
userSchema.post('findOne', function(doc) {
  if (doc) {
    doc._previousCoins = doc.coins;
  }
});

/**
 * Get user stats formatted for display
 * @returns {Object} Formatted user stats
 */
userSchema.methods.getFormattedStats = function() {
  return {
    messagesCount: this.messagesCount.toLocaleString(),
    reactionsCount: this.reactionsCount.toLocaleString(),
    voiceMinutes: this.voiceMinutes.toLocaleString(),
    coins: this.coins.toLocaleString(),
    totalLikes: this.totalLikes.toLocaleString(),
    totalRetweets: this.totalRetweets.toLocaleString(),
    memberSince: this.createdAt.toLocaleDateString()
  };
};

/**
 * Find users by Twitter ID (case insensitive)
 */
userSchema.statics.findByTwitterId = function(twitterId) {
  return this.findOne({ twitterId });
};

/**
 * Find users by Twitter username (case insensitive)
 */
userSchema.statics.findByTwitterUsername = function(username) {
  return this.findOne({ 
    twitterUsername: new RegExp(`^${username}$`, 'i') 
  });
};

/**
 * Find top users by coins (with optional filtering)
 */
userSchema.statics.findTopByCoins = function(limit = 10, options = {}) {
  const query = {};
  
  // Add filtering options if provided
  if (options.minCoins) {
    query.coins = { $gte: options.minCoins };
  }
  
  // Skip specific users if provided
  if (options.excludeIds && options.excludeIds.length > 0) {
    query.discordId = { $nin: options.excludeIds };
  }
  
  return this.find(query, null, { 
    lean: options.lean !== false,
    sort: { coins: -1 },
    limit
  });
};

module.exports = mongoose.model('User', userSchema);