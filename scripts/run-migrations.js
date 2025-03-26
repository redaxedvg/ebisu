// scripts/run-migrations.js
require('dotenv').config();
const { connectDB, closeDB } = require('../src/config/db');
const migrations = require('../src/db/migrations');
const logger = require('../src/utils/logger');

/**
 * Run database migrations
 * This script will apply any pending migrations
 */
async function runMigrations() {
  try {
    logger.info('Starting migration process');
    
    // Connect to database
    await connectDB();
    logger.info('Connected to database');
    
    // Run migrations
    const results = await migrations.runMigrations();
    
    // Log results
    if (results.applied === 0) {
      logger.info('No migrations needed to be applied');
    } else {
      logger.info(`Applied ${results.applied} migrations successfully`);
    }
    
    // Close database connection
    await closeDB();
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { 
      error: error.message,
      stack: error.stack
    });
    
    // Try to close DB connection before exiting
    try {
      await closeDB();
    } catch (err) {
      // Ignore errors during cleanup
    }
    
    process.exit(1);
  }
}

// Run migrations when script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;