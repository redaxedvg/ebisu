// Migration: Initial Indexes Creation
// Created at: 2025-03-26T00:00:00.000Z

/**
 * Apply the migration
 */
exports.up = async function() {
    const mongoose = require('mongoose');
    const logger = require('../../../utils/logger');
    
    logger.info('Running migration: initial-indexes');
    
    // Create indexes on User collection
    await mongoose.connection.collection('users').createIndexes([
      { key: { discordId: 1 }, unique: true, name: 'idx_discord_id' },
      { key: { twitterId: 1 }, sparse: true, name: 'idx_twitter_id' },
      { key: { coins: -1 }, name: 'idx_coins_desc' },
      { key: { messagesCount: -1 }, name: 'idx_messages_desc' },
      { key: { voiceMinutes: -1 }, name: 'idx_voice_desc' }
    ]);
    
    // Create indexes on Tweet collection
    await mongoose.connection.collection('tweets').createIndexes([
      { key: { tweetId: 1 }, unique: true, name: 'idx_tweet_id' },
      { key: { postedAt: -1 }, name: 'idx_posted_at_desc' },
      { key: { finalChecked: 1, postedAt: 1 }, name: 'idx_final_checked_posted_at' }
    ]);
    
    // Create indexes on MarketplaceItem collection
    await mongoose.connection.collection('marketplaceitems').createIndexes([
      { key: { name: 1 }, unique: true, name: 'idx_item_name' },
      { key: { roleId: 1 }, name: 'idx_role_id' }
    ]);
    
    // Create indexes on RewardRole collection
    await mongoose.connection.collection('rewardroles').createIndexes([
      { key: { roleId: 1 }, unique: true, name: 'idx_reward_role_id' }
    ]);
    
    logger.info('Migration completed: initial-indexes');
  };
  
  /**
   * Revert the migration (optional)
   */
  exports.down = async function() {
    const mongoose = require('mongoose');
    const logger = require('../../../utils/logger');
    
    logger.info('Reverting migration: initial-indexes');
    
    // Drop User indexes
    await mongoose.connection.collection('users').dropIndexes();
    
    // Drop Tweet indexes
    await mongoose.connection.collection('tweets').dropIndexes();
    
    // Drop MarketplaceItem indexes
    await mongoose.connection.collection('marketplaceitems').dropIndexes();
    
    // Drop RewardRole indexes
    await mongoose.connection.collection('rewardroles').dropIndexes();
    
    // Keep the _id indexes which are created by default
    
    logger.info('Migration reverted: initial-indexes');
  };