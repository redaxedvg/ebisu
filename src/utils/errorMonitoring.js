// src/utils/errorMonitoring.js
const Sentry = require('@sentry/node');
const config = require('../config');
const logger = require('./logger');

/**
 * Initializes error monitoring service (Sentry)
 * @returns {boolean} True if monitoring was initialized
 */
function initErrorMonitoring() {
  if (config.logging.sentry.dsn) {
    Sentry.init({
      dsn: config.logging.sentry.dsn,
      environment: config.logging.sentry.environment,
      tracesSampleRate: config.logging.sentry.tracesSampleRate,
      
      // Capture only a percentage of transactions in production
      ...(config.server.environment === 'production' && {
        tracesSampleRate: 0.2 
      })
    });
    
    logger.info('Error monitoring initialized with Sentry');
    return true;
  }
  
  logger.warn('Error monitoring not initialized (no DSN provided)');
  return false;
}

/**
 * Captures an exception with additional context
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional contextual information
 */
function captureException(error, context = {}) {
  if (config.logging.sentry.dsn) {
    Sentry.withScope(scope => {
      // Add useful additional context
      scope.setTag('area', context.area || 'unknown');
      
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          username: context.user.username
        });
      }
      
      // Add any additional context as extras
      Object.entries(context).forEach(([key, value]) => {
        if (key !== 'user' && key !== 'area') {
          scope.setExtra(key, value);
        }
      });
      
      Sentry.captureException(error);
    });
  }
  
  // Always log the error locally as well
  logger.error(error.message, { 
    error: error.stack, 
    ...context 
  });
}

/**
 * Wraps an async function with error monitoring
 * @param {Function} fn - The function to wrap
 * @param {Object} context - Context to add on error
 * @returns {Function} Wrapped function that reports errors
 */
function withErrorReporting(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error, context);
      throw error; // Re-throw the error for normal handling
    }
  };
}

module.exports = { 
  initErrorMonitoring, 
  captureException,
  withErrorReporting
};