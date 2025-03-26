// src/utils/rateLimiter.js
const NodeCache = require('node-cache');
const logger = require('./logger');

// LRU cache for rate limiting with 5 minute standard TTL
const rateCache = new NodeCache({ 
  stdTTL: 300, 
  checkperiod: 60,
  useClones: false,
  maxKeys: 10000 // Prevent memory issues by limiting cache size
});

/**
 * Rate limit a specific key
 * @param {string} key - Unique identifier for the rate limit
 * @param {number} limit - Max number of requests in period
 * @param {number} period - Time period in ms
 * @returns {Object} Result with limited status and wait time
 */
function rateLimit(key, limit, period) {
  const now = Date.now();
  const cacheKey = `rate:${key}`;
  
  // Get current state or initialize
  const current = rateCache.get(cacheKey) || { 
    count: 0, 
    firstRequest: now,
    requests: []
  };
  
  // Clean up old requests that fall outside our window
  current.requests = current.requests.filter(time => now - time < period);
  
  // If we have no requests or window has passed, reset tracking
  if (current.requests.length === 0) {
    current.count = 1;
    current.firstRequest = now;
    current.requests = [now];
    rateCache.set(cacheKey, current);
    return { limited: false };
  }
  
  // Add the new request to our tracking
  current.requests.push(now);
  current.count = current.requests.length;
  
  // First request is now the oldest in our window
  current.firstRequest = current.requests[0];
  
  // Save updated state
  rateCache.set(cacheKey, current);
  
  // Check if we've exceeded our limit
  if (current.count > limit) {
    const resetTime = current.firstRequest + period;
    const waitTime = Math.ceil((resetTime - now) / 1000);
    
    logger.debug(`Rate limited: ${key}`, {
      count: current.count,
      limit,
      waitTime
    });
    
    return { 
      limited: true, 
      resetTime,
      waitTime
    };
  }
  
  return { limited: false };
}

/**
 * Clear rate limit data for a specific key
 * @param {string} key - The key to clear
 */
function clearRateLimit(key) {
  const cacheKey = `rate:${key}`;
  rateCache.del(cacheKey);
}

/**
 * Get statistics about rate limiting
 * @returns {Object} Statistics about rate limiting
 */
function getRateLimitStats() {
  const keys = rateCache.keys();
  const stats = {
    totalKeys: keys.length,
    limitedUsers: 0,
    keysByPrefix: {}
  };
  
  keys.forEach(key => {
    const data = rateCache.get(key);
    if (!data) return;
    
    // Count limited users
    if (data.count > 0) {
      stats.limitedUsers++;
    }
    
    // Group by prefix (e.g., "cmd:", "api:")
    const prefix = key.split(':')[1];
    if (prefix) {
      stats.keysByPrefix[prefix] = (stats.keysByPrefix[prefix] || 0) + 1;
    }
  });
  
  return stats;
}

module.exports = { 
  rateLimit,
  clearRateLimit,
  getRateLimitStats
};