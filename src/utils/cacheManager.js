// src/utils/cacheManager.js
const NodeCache = require('node-cache');
const logger = require('./logger');

/**
 * Cache Manager for efficient data access
 */
class CacheManager {
  constructor(options = {}) {
    this.cache = new NodeCache({
      stdTTL: options.defaultTTL || 300, // 5 minutes default
      checkperiod: options.checkPeriod || 60,
      useClones: options.useClones !== undefined ? options.useClones : false,
      maxKeys: options.maxKeys || 5000
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
    
    this.contextLog = logger.withContext({ module: 'CacheManager' });
    
    // Setup automatic stats logging
    setInterval(() => {
      const hitRatio = this.stats.hits / (this.stats.hits + this.stats.misses || 1);
      this.contextLog.debug('Cache statistics', {
        keys: this.cache.keys().length,
        hits: this.stats.hits,
        misses: this.stats.misses,
        sets: this.stats.sets,
        hitRatio: hitRatio.toFixed(2)
      });
    }, options.statsInterval || 300000); // 5 minutes default
  }
  
  /**
   * Get a value from cache, fetching it if not present
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not in cache
   * @param {Object} options - Cache options
   * @returns {Promise} Resolves with the cached or fetched value
   */
  async getOrFetch(key, fetchFn, options = {}) {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    
    this.stats.misses++;
    
    try {
      const fetchedValue = await fetchFn();
      
      if (fetchedValue !== undefined) {
        this.set(key, fetchedValue, options.ttl);
      }
      
      return fetchedValue;
    } catch (error) {
      this.contextLog.error(`Error fetching data for key: ${key}`, {
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Store a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to store
   * @param {number} ttl - Time to live in seconds
   * @returns {boolean} True if successful
   */
  set(key, value, ttl) {
    this.stats.sets++;
    return this.cache.set(key, value, ttl);
  }
  
  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    return value;
  }
  
  /**
   * Delete a value from the cache
   * @param {string} key - Cache key
   * @returns {number} Number of deleted entries
   */
  del(key) {
    return this.cache.del(key);
  }
  
  /**
   * Delete all keys with a given prefix
   * @param {string} prefix - Key prefix
   * @returns {number} Number of deleted entries
   */
  delStartWith(prefix) {
    if (!prefix) return 0;
    
    const keys = this.cache.keys();
    let count = 0;
    
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        if (this.cache.del(key)) {
          count++;
        }
      }
    }
    
    return count;
  }
  
  /**
   * Flush the entire cache
   */
  flush() {
    this.cache.flushAll();
    this.contextLog.info('Cache flushed');
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const keys = this.cache.keys();
    const keyCount = keys.length;
    const memoryUsage = process.memoryUsage();
    
    // Calculate hit ratio
    const requests = this.stats.hits + this.stats.misses;
    const hitRatio = requests > 0 ? this.stats.hits / requests : 0;
    
    // Get key prefixes for analysis
    const prefixes = {};
    keys.forEach(key => {
      const prefixMatch = key.match(/^([^:]+):/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        prefixes[prefix] = (prefixes[prefix] || 0) + 1;
      }
    });
    
    return {
      keys: keyCount,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRatio: hitRatio.toFixed(2),
      memoryMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      prefixes
    };
  }
}

// Create default cache manager instance
const defaultCache = new CacheManager();

module.exports = {
  defaultCache,
  CacheManager
};