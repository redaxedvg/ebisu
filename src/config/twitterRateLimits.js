// src/config/twitterRateLimits.js
/**
 * Twitter API Rate Limits Configuration
 * 
 * This file defines the rate limits for various Twitter API endpoints.
 * Update these values based on your Twitter API access level.
 * For the latest official limits, refer to: 
 * https://developer.twitter.com/en/docs/twitter-api/rate-limits
 */

const rateLimits = {
    // User endpoints
    '/2/users/by': {
      limit: 1,              
      windowMinutes: 1440,
      description: 'User lookup by username, ID, etc.'
    },
    '/2/users/by/username': {
      limit: 3,              
      windowMinutes: 15,
      description: 'User lookup by username'
    },
    '/2/users': {
      limit: 1,              
      windowMinutes: 1440,
      description: 'User lookup by ID'
    },
    
    // Tweet endpoints
    '/2/users/:id/tweets': {
      limit: 1,              // Default: 900 requests per 15-min window
      windowMinutes: 15,
      description: 'Get tweets from a user'
    },
    '/2/tweets': {
      limit: 1,              // Default: 300 requests per 15-min window
      windowMinutes: 15,
      description: 'Tweet lookup'
    },
    
    // Engagement endpoints (typically lower limits)
    '/2/tweets/:id/liking_users': {
      limit: 1,               // Default: 75 requests per 15-min window
      windowMinutes: 15,
      description: 'Get users who liked a tweet'
    },
    '/2/tweets/:id/retweeted_by': {
      limit: 1,               // Default: 75 requests per 15-min window
      windowMinutes: 15,
      description: 'Get users who retweeted a tweet'
    },
    
    // Timeline endpoints
    '/2/users/:id/timelines/reverse_chronological': {
      limit: 1,              // Default: 180 requests per 15-min window
      windowMinutes: 15,
      description: 'User home timeline'
    },
    
    // Default fallback for any unlisted endpoint
    'default': {
      limit: 1,
      windowMinutes: 15,
      description: 'Default fallback for unlisted endpoints'
    }
  };
  
  /**
   * Get rate limit for a specific endpoint
   * @param {string} endpoint - The API endpoint path
   * @returns {Object} The rate limit configuration
   */
  function getRateLimit(endpoint) {
    // First, try exact match
    if (rateLimits[endpoint]) {
      return rateLimits[endpoint];
    }
    
    // Then try matching patterns (handles parameterized URLs)
    for (const pattern in rateLimits) {
      if (pattern === 'default') continue;
      
      const regexPattern = pattern
        .replace(/:[a-zA-Z0-9_]+/g, '[^/]+')  // Replace :id with any non-slash characters
        .replace(/\//g, '\\/');               // Escape forward slashes
      
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(endpoint)) {
        return rateLimits[pattern];
      }
    }
    
    // Fallback to default
    return rateLimits.default;
  }
  
  module.exports = {
    rateLimits,
    getRateLimit
  };