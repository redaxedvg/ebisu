// Migration: Normalize Twitter Usernames
// Created at: 2025-03-26T00:00:02.000Z

/**
 * Apply the migration
 * Normalizes Twitter usernames by removing @ prefix and converting to lowercase
 */
exports.up = async function() {
    const mongoose = require('mongoose');
    const logger = require('../../../utils/logger');
    
    logger.info('Running migration: normalize-twitter-usernames');
    
    // Find users with Twitter usernames
    const users = await mongoose.connection.collection('users').find({
      twitterUsername: { $ne: null, $exists: true }
    }).toArray();
    
    logger.info(`Found ${users.length} users with Twitter usernames`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each user
    for (const user of users) {
      if (!user.twitterUsername) {
        skippedCount++;
        continue;
      }
      
      const originalUsername = user.twitterUsername;
      
      // Normalize: remove @ prefix and convert to lowercase
      let normalizedUsername = originalUsername.trim();
      if (normalizedUsername.startsWith('@')) {
        normalizedUsername = normalizedUsername.substring(1);
      }
      normalizedUsername = normalizedUsername.toLowerCase();
      
      // Skip if no change needed
      if (normalizedUsername === originalUsername) {
        skippedCount++;
        continue;
      }
      
      // Update the user
      await mongoose.connection.collection('users').updateOne(
        { _id: user._id },
        { $set: { twitterUsername: normalizedUsername } }
      );
      
      updatedCount++;
    }
    
    logger.info(`Normalized ${updatedCount} Twitter usernames (${skippedCount} already normalized)`);
    
    // Create case-insensitive index for twitterUsername to improve lookups
    await mongoose.connection.collection('users').createIndex(
      { twitterUsername: 1 },
      { 
        sparse: true,
        collation: { locale: 'en', strength: 2 },
        name: 'idx_twitter_username_case_insensitive'
      }
    );
    
    logger.info('Created case-insensitive index for twitterUsername');
    logger.info('Migration completed: normalize-twitter-usernames');
  };
  
  /**
   * Revert the migration
   * Note: We can't restore the original casing/format since that information is lost
   * This just drops the new index
   */
  exports.down = async function() {
    const mongoose = require('mongoose');
    const logger = require('../../../utils/logger');
    
    logger.info('Reverting migration: normalize-twitter-usernames');
    
    // Drop the case-insensitive index
    await mongoose.connection.collection('users').dropIndex('idx_twitter_username_case_insensitive');
    
    logger.info('Removed case-insensitive index for twitterUsername');
    logger.info('Note: Original username casing could not be restored');
    
    logger.info('Migration reverted: normalize-twitter-usernames');
  };