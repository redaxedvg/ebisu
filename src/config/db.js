// src/config/db.js
require('dotenv').config();
const mongoose = require('mongoose');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

async function connectDB() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    logger.error('Error: MONGO_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    logger.info('Connected to MongoDB Atlas');
  } catch (err) {
    logger.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
}

module.exports = connectDB;