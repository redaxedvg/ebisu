// Migration: Add User Preferences
// Created at: 2025-03-26T00:00:01.000Z

/**
 * Apply the migration
 * Adds user preferences field to the User model
 */
exports.up = async function() {
    const mongoose = require('mongoose');
    const logger = require('../../../utils/logger');
    
    logger.info('Running migration: add-user-preferences');
    
    // Add preferences field to existing users
    const result = await mongoose.connection.collection('users').updateMany(
      { preferences: { $exists: false } },
      { 
        $set: { 
          preferences: {
            notificationsEnabled: true,
            displayMode: 'default',
            language: 'en',
            timezone: 'UTC'
          }
        }
      }
    );
    
    logger.info(`Updated ${result.modifiedCount} user documents with default preferences`);
    
    // Create index on preferences.language for potential filtering
    await mongoose.connection.collection('users').createIndex(
      { 'preferences.language': 1 },
      { name: 'idx_preferences_language' }
    );
    
    logger.info('Migration completed: add-user-preferences');
  };
  
  /**
   * Revert the migration
   * Removes the preferences field from users
   */
  exports.down = async function() {
    const mongoose = require('mongoose');
    const logger = require('../../../utils/logger');
    
    logger.info('Reverting migration: add-user-preferences');
    
    // Remove preferences field
    const result = await mongoose.connection.collection('users').updateMany(
      {},
      { $unset: { preferences: "" } }
    );
    
    logger.info(`Removed preferences from ${result.modifiedCount} user documents`);
    
    // Drop the index
    await mongoose.connection.collection('users').dropIndex('idx_preferences_language');
    
    logger.info('Migration reverted: add-user-preferences');
  };