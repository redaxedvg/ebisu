// src/utils/validator.js
const logger = require('./logger');

/**
 * Validation errors that can be returned to users
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validates a positive integer
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {number} The validated integer value
 * @throws {ValidationError} If validation fails
 */
function validatePositiveInteger(value, fieldName = 'Value') {
  // Handle string inputs (e.g. from Discord)
  if (typeof value === 'string') {
    value = parseInt(value, 10);
  }
  
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName);
  }
  
  if (value <= 0) {
    throw new ValidationError(`${fieldName} must be positive`, fieldName);
  }
  
  if (!Number.isInteger(value)) {
    throw new ValidationError(`${fieldName} must be an integer`, fieldName);
  }
  
  return value;
}

/**
 * Validates a string against maximum and minimum length constraints
 * @param {string} value - String to validate
 * @param {Object} options - Validation options
 * @returns {string} The validated string
 * @throws {ValidationError} If validation fails
 */
function validateString(value, options = {}) {
  const { 
    fieldName = 'Value',
    minLength = 0,
    maxLength = Number.MAX_SAFE_INTEGER,
    allowEmpty = false,
    trim = true,
    pattern = null
  } = options;
  
  // Handle non-string inputs
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }
  
  // Apply trimming if requested
  const processedValue = trim ? value.trim() : value;
  
  // Check empty constraint
  if (!allowEmpty && processedValue.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }
  
  // Check length constraints
  if (processedValue.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`, 
      fieldName
    );
  }
  
  if (processedValue.length > maxLength) {
    throw new ValidationError(
      `${fieldName} cannot exceed ${maxLength} characters`, 
      fieldName
    );
  }
  
  // Check pattern constraint
  if (pattern !== null && !pattern.test(processedValue)) {
    throw new ValidationError(
      `${fieldName} format is invalid`,
      fieldName
    );
  }
  
  return processedValue;
}

/**
 * Validates a Discord ID
 * @param {string} id - Discord ID to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {string} The validated Discord ID
 * @throws {ValidationError} If validation fails
 */
function validateDiscordId(id, fieldName = 'ID') {
  // Discord IDs are numeric strings, usually 17-19 digits
  const processedId = String(id).trim();
  
  if (!/^\d{17,19}$/.test(processedId)) {
    throw new ValidationError(`Invalid Discord ${fieldName}`, fieldName);
  }
  
  return processedId;
}

/**
 * Validates a URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {string} The validated URL
 * @throws {ValidationError} If validation fails
 */
function validateUrl(url, options = {}) {
  const {
    fieldName = 'URL',
    protocols = ['http', 'https'],
    requireTLD = true,
    requireProtocol = true,
    allowQueryString = true
  } = options;
  
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (requireProtocol && !protocols.includes(urlObj.protocol.replace(':', ''))) {
      throw new ValidationError(
        `${fieldName} must use one of these protocols: ${protocols.join(', ')}`, 
        fieldName
      );
    }
    
    // Check TLD
    if (requireTLD) {
      const hostnameParts = urlObj.hostname.split('.');
      if (hostnameParts.length < 2 || hostnameParts[hostnameParts.length - 1].length < 2) {
        throw new ValidationError(`${fieldName} must include a valid domain`, fieldName);
      }
    }
    
    // Check query string
    if (!allowQueryString && urlObj.search) {
      throw new ValidationError(`${fieldName} cannot contain a query string`, fieldName);
    }
    
    return url;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(`Invalid ${fieldName}`, fieldName);
  }
}

/**
 * Validates a Twitter username
 * @param {string} username - Twitter username to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {string} The validated Twitter username
 * @throws {ValidationError} If validation fails
 */
function validateTwitterUsername(username, fieldName = 'Twitter username') {
  // Remove @ prefix if present
  let processedUsername = String(username).trim().replace(/^@/, '');
  
  // Twitter usernames are 1-15 characters and only contain alphanumeric chars and underscores
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(processedUsername)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Must be 1-15 characters and contain only letters, numbers, and underscores.`,
      fieldName
    );
  }
  
  return processedUsername;
}

/**
 * Handles validation errors by replying to Discord interactions
 * @param {Error} error - The error that occurred
 * @param {Object} interaction - Discord interaction object
 * @returns {Promise} The result of replying to the interaction
 */
async function handleValidationError(error, interaction) {
  if (error instanceof ValidationError) {
    logger.debug('Validation error', { 
      error: error.message,
      field: error.field,
      user: interaction.user.id
    });
    
    const reply = { 
      content: `📋 ${error.message}`,
      ephemeral: true
    };
    
    if (interaction.deferred) {
      return interaction.editReply(reply);
    } else {
      return interaction.reply(reply);
    }
  }
  
  // Not a validation error, rethrow
  throw error;
}

/**
 * Wraps a command handler with validation
 * @param {Function} validationFn - Function to run validations
 * @param {Function} handler - Command handler function
 * @returns {Function} Wrapped handler with validation
 */
function withValidation(validationFn, handler) {
  return async (interaction) => {
    try {
      // Run validations first
      await validationFn(interaction);
      // If validations pass, run the handler
      return await handler(interaction);
    } catch (error) {
      // Handle validation errors
      if (error instanceof ValidationError) {
        return handleValidationError(error, interaction);
      }
      // For other errors, let the normal error handling take over
      throw error;
    }
  };
}

module.exports = {
  ValidationError,
  validatePositiveInteger,
  validateString,
  validateDiscordId,
  validateUrl,
  validateTwitterUsername,
  handleValidationError,
  withValidation
};