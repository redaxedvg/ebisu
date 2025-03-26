// src/utils/apiClient.js
const axios = require('axios');
const logger = require('./logger');
const { captureException } = require('./errorMonitoring');
const { defaultCache } = require('./cacheManager');

/**
 * Enhanced API client with retries, caching, and error handling
 */
class ApiClient {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 10000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      defaultCacheTTL: options.defaultCacheTTL || 300, // 5 minutes
      ...options
    };
    
    this.contextLog = logger.withContext({ module: 'ApiClient' });
    
    // Create axios instance with defaults
    this.client = axios.create({
      timeout: this.options.timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': options.userAgent || 'DiscordBot/1.0'
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        if (this.options.debug) {
          this.contextLog.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            params: config.params
          });
        }
        return config;
      },
      (error) => {
        this.contextLog.error('API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        if (this.options.debug) {
          this.contextLog.debug(`API Response: ${response.status} ${response.config.url}`, {
            size: response.headers['content-length'] || 'unknown'
          });
        }
        return response;
      },
      (error) => {
        // Don't log 'canceled' errors which happen during retries
        if (axios.isCancel(error)) {
          return Promise.reject(error);
        }
        
        this.contextLog.error('API Response Error', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Make a cached GET request
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async get(url, options = {}) {
    const {
      params = {},
      headers = {},
      useCache = true,
      cacheTTL = this.options.defaultCacheTTL,
      retry = true,
      maxRetries = this.options.maxRetries
    } = options;
    
    // Check cache first if enabled
    if (useCache) {
      const cacheKey = `api:${url}:${JSON.stringify(params)}`;
      const cachedData = defaultCache.get(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
    }
    
    // Make request with retries if enabled
    const response = await this.makeRequestWithRetry(
      'get',
      url,
      { params, headers, retry, maxRetries }
    );
    
    // Cache the response if caching is enabled
    if (useCache && response) {
      const cacheKey = `api:${url}:${JSON.stringify(params)}`;
      defaultCache.set(cacheKey, response, cacheTTL);
    }
    
    return response;
  }
  
  /**
   * Make a POST request
   * @param {string} url - URL to request
   * @param {Object} data - POST data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async post(url, data = {}, options = {}) {
    const {
      headers = {},
      retry = true,
      maxRetries = this.options.maxRetries
    } = options;
    
    return this.makeRequestWithRetry(
      'post',
      url,
      { data, headers, retry, maxRetries }
    );
  }
  
  /**
   * Make a PUT request
   * @param {string} url - URL to request
   * @param {Object} data - PUT data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async put(url, data = {}, options = {}) {
    const {
      headers = {},
      retry = false, // Don't retry PUT by default
      maxRetries = this.options.maxRetries
    } = options;
    
    return this.makeRequestWithRetry(
      'put',
      url,
      { data, headers, retry, maxRetries }
    );
  }
  
  /**
   * Make a DELETE request
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async delete(url, options = {}) {
    const {
      headers = {},
      retry = false, // Don't retry DELETE by default
      maxRetries = this.options.maxRetries
    } = options;
    
    return this.makeRequestWithRetry(
      'delete',
      url,
      { headers, retry, maxRetries }
    );
  }
  
  /**
   * Make a request with retry capability
   * @param {string} method - HTTP method
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async makeRequestWithRetry(method, url, options) {
    const {
      data,
      params,
      headers,
      retry = true,
      maxRetries = this.options.maxRetries
    } = options;
    
    let retries = 0;
    
    while (true) {
      try {
        const response = await this.client({
          method,
          url,
          data,
          params,
          headers
        });
        
        return response.data;
      } catch (error) {
        // Don't retry if retries are disabled or we've reached max retries
        if (!retry || retries >= maxRetries) {
          throw error;
        }
        
        // Only retry on certain status codes or network errors
        if (error.response) {
          const { status } = error.response;
          
          // Retry on 429 (rate limit), 500s, and certain network errors
          if (status !== 429 && (status < 500 || status >= 600)) {
            throw error;
          }
        }
        
        retries++;
        
        // Calculate delay with exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, retries - 1);
        
        this.contextLog.warn(`Retrying ${method.toUpperCase()} ${url} (${retries}/${maxRetries})`, {
          status: error.response?.status,
          delay
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  /**
   * Clear API cache by URL pattern
   * @param {string} urlPattern - URL pattern to match
   * @returns {number} Number of cache entries cleared
   */
  clearCache(urlPattern) {
    let count = 0;
    const keys = defaultCache.cache.keys();
    
    for (const key of keys) {
      if (key.startsWith('api:') && key.includes(urlPattern)) {
        defaultCache.del(key);
        count++;
      }
    }
    
    this.contextLog.info(`Cleared ${count} API cache entries matching "${urlPattern}"`);
    return count;
  }
}

// Create default instance
const apiClient = new ApiClient();

module.exports = { apiClient, ApiClient };