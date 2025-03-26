// scripts/create-migration.js
require('dotenv').config();
const migrations = require('../src/db/migrations');
const logger = require('../src/utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Create a new migration file
 * This script generates a new timestamped migration file
 */
async function createMigration() {
  try {
    // Get migration name from command line
    const name = process.argv[2];
    
    if (!name) {
      console.error('Error: Migration name is required');
      console.error('Usage: npm run create-migration "description of migration"');
      process.exit(1);
    }
    
    // Ensure migrations directory exists
    const migrationsDir = path.join(__dirname, '../src/db/migrations/scripts');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      console.log(`Created migrations directory: ${migrationsDir}`);
    }
    
    // Create the migration file
    const filePath = await migrations.createMigration(name);
    
    logger.info(`Created migration file: ${filePath}`);
    
    console.log('');
    console.log(`Migration file created: ${path.basename(filePath)}`);
    console.log('');
    console.log(`Edit the file to implement your database changes:`);
    console.log(`- Add your migration logic to the 'up' function`);
    console.log(`- Add rollback logic to the 'down' function if needed`);
    console.log('');
    console.log(`Then run the migration with: npm run migrate`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to create migration', { 
      error: error.message,
      stack: error.stack
    });
    
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run migration creation when script is executed directly
if (require.main === module) {
  createMigration();
}

module.exports = createMigration;