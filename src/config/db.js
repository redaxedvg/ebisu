// src/config/db.js
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Connects to MongoDB with proper connection options and events
 * @returns {Promise} Resolves when connection is established
 */
async function connectDB() {
  const { uri, options } = config.mongodb;
  
  // Set mongoose connection options
  mongoose.set('strictQuery', true);
  
  // Setup event listeners for connection management
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established');
  });
  
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
    // Attempt to reconnect if this is a connection error
    if (err.name === 'MongoNetworkError') {
      logger.info('Attempting to reconnect to MongoDB...');
    }
  });
  
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
  });
  
  // Handle app termination - close connection gracefully
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    } catch (err) {
      logger.error('Error closing MongoDB connection', { error: err.message });
      process.exit(1);
    }
  });
  
  // Connect to MongoDB
  try {
    await mongoose.connect(uri, {
      ...options,
      // Additional safety options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    
    return mongoose.connection;
  } catch (err) {
    logger.error('Failed to connect to MongoDB', { 
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

/**
 * Closes the database connection
 * @returns {Promise} Resolves when connection is closed
 */
async function closeDB() {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error('Error closing MongoDB connection', { 
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { connectDB, closeDB };