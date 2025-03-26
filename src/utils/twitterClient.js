// src/utils/twitterClient.js
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const logger = require('./logger');
const config = require('../config');
const { defaultCache } = require('./cacheManager');
const { getRateLimit } = require('../config/twitterRateLimits');

/**
 * Twitter API Client with configurable rate limits, retries, and caching
 */
class TwitterClient {
  constructor() {
    // Validate required credentials
    this.validateCredentials();
    
    // Setup OAuth 1.0a
    this.oauth = OAuth({
      consumer: { 
        key: config.twitter.consumerKey, 
        secret: config.twitter.consumerSecret 
      },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString, key) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      },
    });
    
    this.token = { 
      key: config.twitter.accessToken, 
      secret: config.twitter.accessTokenSecret 
    };
    
    this.contextLog = logger.withContext({ module: 'TwitterClient' });
    
    // Request tracking for rate limiting
    this.requestCounts = {};
    this.lastReset = Date.now();
  }
  
  /**
   * Validate that all required Twitter credentials are present
   * @throws {Error} If credentials are missing
   */
  validateCredentials() {
    const required = [
      'consumerKey',
      'consumerSecret',
      'accessToken',
      'accessTokenSecret',
      'bearerToken'
    ];
    
    const missing = required.filter(key => !config.twitter[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing Twitter API credentials: ${missing.join(', ')}`);
    }
  }
  
  /**
   * Check if an endpoint has exceeded its rate limit
   * @param {string} endpoint - API endpoint to check
   * @returns {Object} Rate limit status and information
   */
  checkRateLimit(endpoint) {
    const now = Date.now();
    const rateLimit = getRateLimit(endpoint);
    const { limit, windowMinutes } = rateLimit;
    const windowMs = windowMinutes * 60 * 1000;
    
    // Reset counts if outside window
    if (now - this.lastReset > windowMs) {
      this.requestCounts = {};
      this.lastReset = now;
    }
    
    // Initialize or increment count
    this.requestCounts[endpoint] = (this.requestCounts[endpoint] || 0) + 1;
    const currentCount = this.requestCounts[endpoint];
    
    // Check if limit exceeded
    const isLimited = currentCount > limit;
    
    // Calculate reset time
    const resetTime = this.lastReset + windowMs;
    const waitTimeMs = Math.max(0, resetTime - now);
    const waitTimeMinutes = Math.ceil(waitTimeMs / 60000);
    
    return {
      isLimited,
      currentCount,
      limit,
      resetTime,
      waitTimeMs,
      waitTimeMinutes,
      endpoint,
      description: rateLimit.description
    };
  }
  
  /**
   * Make an authenticated GET request to the Twitter API
   * @param {string} url - Full Twitter API URL
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Twitter API response
   */
  async get(url, params = {}, options = {}) {
    // Extract endpoint for rate limiting
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Check rate limits
    const rateLimitStatus = this.checkRateLimit(pathname);
    
    if (rateLimitStatus.isLimited && !options.bypassRateLimit) {
      this.contextLog.warn('Twitter API rate limit exceeded', rateLimitStatus);
      throw new Error(
        `Rate limit exceeded for ${pathname}. ` + 
        `Used ${rateLimitStatus.currentCount}/${rateLimitStatus.limit} requests. ` +
        `Resets in ${rateLimitStatus.waitTimeMinutes} minutes.`
      );
    }
    
    // Check cache if enabled
    if (options.useCache !== false) {
      const cacheKey = `twitter:${url}:${JSON.stringify(params)}`;
      const cached = defaultCache.get(cacheKey);
      
      if (cached) {
        this.contextLog.debug('Using cached Twitter response', { endpoint: pathname });
        return cached;
      }
    }
    
    try {
      // Prepare request data for OAuth
      const requestData = { url, method: 'GET' };
      const authHeader = this.oauth.authorize(requestData, this.token);
      
      const headers = {
        ...this.oauth.toHeader(authHeader),
        'Content-Type': 'application/json',
      };
      
      this.contextLog.debug('Making Twitter API request', { 
        endpoint: pathname,
        params: Object.keys(params)
      });
      
      // Make the request
      const response = await axios.get(url, { 
        headers,
        params,
        timeout: options.timeout || 10000
      });
      
      // Cache successful responses
      if (options.useCache !== false && response.data) {
        const cacheKey = `twitter:${url}:${JSON.stringify(params)}`;
        const cacheTTL = options.cacheTTL || 300; // 5 minutes default
        defaultCache.set(cacheKey, response.data, cacheTTL);
      }
      
      return response.data;
    } catch (error) {
      this.handleApiError(error, url, params);
      throw error;
    }
  }
  
  /**
   * Handle Twitter API errors with better logging
   * @param {Error} error - The error that occurred
   * @param {string} url - The URL that was requested
   * @param {Object} params - The parameters that were sent
   */
  handleApiError(error, url, params) {
    // Extract endpoint for better error reporting
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    if (error.response) {
      // Twitter API returned an error
      const { status, data } = error.response;
      
      this.contextLog.error('Twitter API error response', {
        endpoint: pathname,
        status,
        errorCode: data?.errors?.[0]?.code,
        errorMessage: data?.errors?.[0]?.message,
        params: Object.keys(params)
      });
      
      // Handle specific error codes
      if (status === 429) {
        // Rate limit exceeded
        const resetHeader = error.response.headers['x-rate-limit-reset'];
        if (resetHeader) {
          const resetTime = new Date(parseInt(resetHeader) * 1000);
          const waitTime = Math.ceil((resetTime - new Date()) / 1000);
          
          this.contextLog.warn(`Rate limit exceeded for ${pathname}. Resets in ${waitTime} seconds.`);
        }
      }
    } else if (error.request) {
      // No response received
      this.contextLog.error('Twitter API request error (no response)', {
        endpoint: pathname,
        message: error.message
      });
    } else {
      // Error setting up the request
      this.contextLog.error('Twitter API client error', {
        endpoint: pathname,
        message: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * Get users who liked a tweet
   * @param {string} tweetId - Twitter tweet ID
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response with liking users
   */
  async getTweetLikingUsers(tweetId, options = {}) {
    if (!tweetId) throw new Error('tweetId is required');
    
    const url = `https://api.twitter.com/2/tweets/${tweetId}/liking_users`;
    return this.get(url, {}, { 
      cacheTTL: 60, // 1 minute cache for likes
      ...options
    });
  }
  
  /**
   * Get users who retweeted a tweet
   * @param {string} tweetId - Twitter tweet ID
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response with retweeting users
   */
  async getTweetRetweetingUsers(tweetId, options = {}) {
    if (!tweetId) throw new Error('tweetId is required');
    
    const url = `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by`;
    return this.get(url, {}, { 
      cacheTTL: 60, // 1 minute cache for retweets
      ...options
    });
  }
  
  /**
   * Get latest tweets from a user
   * @param {string} userId - Twitter user ID
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response with tweets
   */
  async getUserTweets(userId, options = {}) {
    if (!userId) throw new Error('userId is required');
    
    const url = `https://api.twitter.com/2/users/${userId}/tweets`;
    
    const params = {
      max_results: options.count || 5,
      'tweet.fields': options.fields || 'created_at,text',
      expansions: options.expansions || 'attachments.media_keys',
      'media.fields': options.mediaFields || 'url,type'
    };
    
    return this.get(url, params, { 
      cacheTTL: 300, // 5 minute cache for tweets
      ...options
    });
  }
  
  /**
   * Get user information by username
   * @param {string} username - Twitter username
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response with user data
   */
  async getUserByUsername(username, options = {}) {
    if (!username) throw new Error('username is required');
    
    // Remove @ prefix if present
    username = username.replace(/^@/, '');
    
    const url = `https://api.twitter.com/2/users/by/username/${username}`;
    
    const params = {
      'user.fields': options.fields || 'id,name,username,profile_image_url'
    };
    
    return this.get(url, params, { 
      cacheTTL: 3600, // 1 hour cache for user info
      ...options
    });
  }
  
  /**
   * Get current rate limit status for an endpoint
   * @param {string} endpoint - The API endpoint to check
   * @returns {Object} Current rate limit information
   */
  getRateLimitStatus(endpoint) {
    return this.checkRateLimit(endpoint);
  }
  
  /**
   * Get all rate limit statuses
   * @returns {Object} All rate limit information
   */
  getAllRateLimitStatuses() {
    const now = Date.now();
    const allEndpoints = Object.keys(this.requestCounts);
    
    return allEndpoints.map(endpoint => {
      const status = this.checkRateLimit(endpoint);
      status.remainingRequests = status.limit - status.currentCount;
      status.resetInMinutes = Math.ceil((status.resetTime - now) / 60000);
      return status;
    });
  }
  
  /**
   * Clear the cache for Twitter API responses
   * @param {string} pattern - Optional URL pattern to match
   * @returns {number} Number of cache entries cleared
   */
  clearCache(pattern = '') {
    let count = 0;
    const keys = defaultCache.cache.keys();
    
    for (const key of keys) {
      if (key.startsWith('twitter:') && key.includes(pattern)) {
        defaultCache.del(key);
        count++;
      }
    }
    
    this.contextLog.info(`Cleared ${count} Twitter API cache entries`);
    return count;
  }
  
  /**
   * Reset rate limit counters for testing or after configuration changes
   */
  resetRateLimitCounters() {
    this.requestCounts = {};
    this.lastReset = Date.now();
    this.contextLog.info('Reset all Twitter API rate limit counters');
  }
}

// Create singleton instance
const twitterClient = new TwitterClient();

module.exports = twitterClient;