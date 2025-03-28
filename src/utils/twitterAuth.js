// src/utils/twitterAuth.js
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const logger = require('./logger');
const config = require('../config');
const { defaultCache } = require('./cacheManager');

/**
 * Twitter API Client with built-in caching and error handling
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
    
    // Request throttling
    this.requestCounts = {
      lastResetTime: Date.now(),
      counts: {}
    };
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
   * Track API request rate and handle throttling
   * @param {string} endpoint - API endpoint being called
   * @returns {boolean} False if rate limit exceeded
   */
  trackRequestRate(endpoint) {
    const now = Date.now();
    const resetWindow = 15 * 60 * 1000; // 15 minutes
    
    // Reset counters if window has passed
    if (now - this.requestCounts.lastResetTime > resetWindow) {
      this.requestCounts = {
        lastResetTime: now,
        counts: {}
      };
    }
    
    // Initialize or increment endpoint counter
    this.requestCounts.counts[endpoint] = (this.requestCounts.counts[endpoint] || 0) + 1;
    
    // Check rate limits based on endpoint
    // Twitter v2 rate limits vary by endpoint
    const rateLimit = endpoint.includes('/liking_users') || endpoint.includes('/retweeted_by')
      ? 75  // Lower limit for these endpoints
      : 180; // Default limit for most endpoints
    
    if (this.requestCounts.counts[endpoint] > rateLimit) {
      this.contextLog.warn('Rate limit exceeded for Twitter API', {
        endpoint,
        count: this.requestCounts.counts[endpoint],
        limit: rateLimit
      });
      return false;
    }
    
    return true;
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
    const endpoint = url.split('?')[0].split('twitter.com')[1];
    
    // Check rate limits
    if (!options.bypassRateLimit && !this.trackRequestRate(endpoint)) {
      throw new Error(`Rate limit exceeded for endpoint: ${endpoint}`);
    }
    
    // Check cache if enabled
    if (options.useCache !== false) {
      const cacheKey = `twitter:${url}:${JSON.stringify(params)}`;
      const cached = defaultCache.get(cacheKey);
      
      if (cached) {
        this.contextLog.debug('Using cached Twitter response', { endpoint });
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
        endpoint,
        params: Object.keys(params)
      });
      
      // Make the request
      const response = await axios.get(url, { 
        headers,
        params
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
    const endpoint = url.split('?')[0].split('twitter.com')[1];
    
    if (error.response) {
      // Twitter API returned an error
      const { status, data } = error.response;
      
      this.contextLog.error('Twitter API error response', {
        endpoint,
        status,
        errorCode: data?.errors?.[0]?.code,
        errorMessage: data?.errors?.[0]?.message,
        params: Object.keys(params)
      });
      
      // Handle specific error codes
      if (status === 429) {
        // Rate limit exceeded - force reset our counter
        this.requestCounts.counts[endpoint] = 999;
      }
    } else if (error.request) {
      // No response received
      this.contextLog.error('Twitter API request error (no response)', {
        endpoint,
        message: error.message
      });
    } else {
      // Error setting up the request
      this.contextLog.error('Twitter API client error', {
        endpoint,
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
}

// Create singleton instance
const twitterClient = new TwitterClient();

module.exports = twitterClient;