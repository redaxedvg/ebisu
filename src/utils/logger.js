// src/utils/logger.js
const winston = require('winston');
const { format } = winston;
const config = require('../config');

// Custom format for development to make logs more readable
const developmentFormat = format.printf(({ level, message, timestamp, ...metadata }) => {
  let meta = '';
  if (Object.keys(metadata).length > 0 && metadata.metadata) {
    meta = JSON.stringify(metadata.metadata);
  }
  return `${timestamp} ${level}: ${message} ${meta}`;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.metadata()
  ),
  defaultMeta: { service: 'discord-bot' },
  transports: [
    new winston.transports.Console({
      format: config.server.environment === 'production' 
        ? format.combine(format.json())
        : format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            developmentFormat
          )
    })
  ]
});

// Add file transports in production
if (config.server.environment === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error',
    format: format.combine(format.json())
  }));
  
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log',
    format: format.combine(format.json())
  }));
}

// Helper method to add context to a log message
logger.withContext = function(context) {
  return {
    debug: (message, meta = {}) => this.debug(message, { ...meta, ...context }),
    info: (message, meta = {}) => this.info(message, { ...meta, ...context }),
    warn: (message, meta = {}) => this.warn(message, { ...meta, ...context }),
    error: (message, meta = {}) => this.error(message, { ...meta, ...context })
  };
};

module.exports = logger;