// src/db/migrations/index.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * Migration schema to track applied migrations
 */
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now }
});

const Migration = mongoose.model('Migration', migrationSchema);

/**
 * Migration manager to handle database schema changes
 */
class MigrationManager {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'scripts');
    this.contextLog = logger.withContext({ module: 'MigrationManager' });
  }
  
  /**
   * Get all available migration files
   * @returns {Array} Sorted array of migration file names
   */
  async getAvailableMigrations() {
    const files = await fs.promises.readdir(this.migrationsPath);
    
    // Filter for JavaScript files with timestamp naming pattern
    return files
      .filter(file => /^\d{14}-.+\.js$/.test(file))
      .sort(); // Sort alphabetically to ensure timestamp order
  }
  
  /**
   * Get migrations that have already been applied
   * @returns {Array} Applied migrations
   */
  async getAppliedMigrations() {
    const migrations = await Migration.find().sort({ name: 1 });
    return migrations.map(m => m.name);
  }
  
  /**
   * Apply pending migrations
   * @returns {Object} Results of migration run
   */
  async runMigrations() {
    this.contextLog.info('Starting database migrations');
    
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    
    // Filter for migrations that haven't been applied
    const pendingMigrations = availableMigrations.filter(
      name => !appliedMigrations.includes(name)
    );
    
    if (pendingMigrations.length === 0) {
      this.contextLog.info('No pending migrations to apply');
      return { applied: 0, pending: 0 };
    }
    
    this.contextLog.info(`Found ${pendingMigrations.length} pending migrations`);
    
    let appliedCount = 0;
    
    // Run migrations in order
    for (const migrationName of pendingMigrations) {
      try {
        this.contextLog.info(`Applying migration: ${migrationName}`);
        
        // Import and run the migration
        const migrationPath = path.join(this.migrationsPath, migrationName);
        const migration = require(migrationPath);
        
        if (typeof migration.up !== 'function') {
          throw new Error(`Migration ${migrationName} does not export an 'up' function`);
        }
        
        // Execute the migration
        await migration.up();
        
        // Record that the migration has been applied
        await Migration.create({ name: migrationName });
        
        appliedCount++;
        this.contextLog.info(`Successfully applied migration: ${migrationName}`);
      } catch (error) {
        this.contextLog.error(`Failed to apply migration ${migrationName}`, {
          error: error.message,
          stack: error.stack
        });
        
        // Rethrow to stop migration process
        throw new Error(`Migration ${migrationName} failed: ${error.message}`);
      }
    }
    
    this.contextLog.info(`Applied ${appliedCount} migrations successfully`);
    
    return {
      applied: appliedCount,
      pending: pendingMigrations.length - appliedCount
    };
  }
  
  /**
   * Create a new migration file
   * @param {string} name - Description of the migration
   * @returns {string} Path to the created migration file
   */
  async createMigration(name) {
    // Format name by replacing spaces with dashes and removing special chars
    const formattedName = name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, '-');
    
    // Generate timestamp for the migration
    const timestamp = new Date().toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);
    
    const fileName = `${timestamp}-${formattedName}.js`;
    const filePath = path.join(this.migrationsPath, fileName);
    
    // Migration template
    const template = `// Migration: ${name}
// Created at: ${new Date().toISOString()}

/**
 * Apply the migration
 */
exports.up = async function() {
  // TODO: Implement the migration
  // Example:
  // const User = require('../../models/User');
  // await User.updateMany({}, { $set: { newField: 'defaultValue' } });
};

/**
 * Revert the migration (optional)
 */
exports.down = async function() {
  // TODO: Implement the rollback logic
};
`;
    
    await fs.promises.writeFile(filePath, template, 'utf8');
    
    this.contextLog.info(`Created new migration: ${fileName}`);
    
    return filePath;
  }
}

module.exports = new MigrationManager();