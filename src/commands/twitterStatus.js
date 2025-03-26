// src/commands/twitterStatus.js
const { EmbedBuilder } = require('discord.js');
const twitterClient = require('../utils/twitterClient');
const logger = require('../utils/logger');
const checkAdmin = require('../utils/checkAdmin');
const commandRegistry = require('../utils/commandRegistry');
const { captureException } = require('../utils/errorMonitoring');

/**
 * Twitter Status Command
 * Displays Twitter API rate limit information for administrators
 */
const twitterStatusCommand = {
  name: 'twitter-status',
  description: 'View Twitter API rate limit status and information (Admin only)',
  
  /**
   * Execute the Twitter status command
   * @param {Object} interaction - Discord interaction
   */
  async execute(interaction) {
    // Admin-only command
    if (!(await checkAdmin(interaction))) return;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get all rate limit statuses
      const statuses = twitterClient.getAllRateLimitStatuses();
      
      // Sort by usage percentage (highest first)
      statuses.sort((a, b) => {
        const aPercent = (a.currentCount / a.limit) * 100;
        const bPercent = (b.currentCount / b.limit) * 100;
        return bPercent - aPercent;
      });
      
      // Create embed for displaying the information
      const embed = new EmbedBuilder()
        .setTitle('Twitter API Rate Limit Status')
        .setColor(0x1DA1F2) // Twitter blue
        .setDescription('Current rate limit status for Twitter API endpoints')
        .setFooter({ text: `Last reset: ${new Date(twitterClient.lastReset).toLocaleString()}` });
      
      // Add fields for each endpoint (limit to top 10 by usage)
      const topStatuses = statuses.slice(0, 10);
      
      for (const status of topStatuses) {
        const usedPercent = Math.round((status.currentCount / status.limit) * 100);
        const progressBar = createProgressBar(usedPercent);
        
        embed.addFields({
          name: formatEndpoint(status.endpoint),
          value: `${progressBar} ${status.currentCount}/${status.limit} (${usedPercent}%)\n` +
                 `Remaining: ${status.limit - status.currentCount} requests\n` +
                 `Resets in: ${status.resetInMinutes} minutes`
        });
      }
      
      // Add summary field
      const totalEndpoints = statuses.length;
      const almostLimited = statuses.filter(s => (s.currentCount / s.limit) > 0.7).length;
      
      embed.addFields({
        name: 'Summary',
        value: `Total endpoints: ${totalEndpoints}\n` +
               `Endpoints > 70% used: ${almostLimited}\n` +
               `Cache count: ${getCacheCount()}`
      });
      
      // Reply with the embed
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      captureException(error, { 
        command: 'twitter-status',
        user: interaction.user.id
      });
      
      logger.error('Error in twitter-status command', { error: error.message });
      await interaction.editReply('An error occurred while fetching Twitter API status.');
    }
  },
  
  /**
   * Reset rate limit counters subcommand
   * @param {Object} interaction - Discord interaction
   */
  async resetRateLimits(interaction) {
    // Admin-only command
    if (!(await checkAdmin(interaction))) return;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Reset the rate limit counters
      twitterClient.resetRateLimitCounters();
      
      await interaction.editReply('Twitter API rate limit counters have been reset.');
    } catch (error) {
      captureException(error, { 
        command: 'twitter-status',
        subcommand: 'reset',
        user: interaction.user.id
      });
      
      logger.error('Error resetting Twitter rate limits', { error: error.message });
      await interaction.editReply('An error occurred while resetting rate limits.');
    }
  },
  
  /**
   * Clear Twitter API cache subcommand
   * @param {Object} interaction - Discord interaction
   */
  async clearCache(interaction) {
    // Admin-only command
    if (!(await checkAdmin(interaction))) return;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get optional URL pattern
      const pattern = interaction.options.getString('pattern') || '';
      
      // Clear the cache
      const count = twitterClient.clearCache(pattern);
      
      await interaction.editReply(`Cleared ${count} Twitter API cache entries.`);
    } catch (error) {
      captureException(error, { 
        command: 'twitter-status',
        subcommand: 'clear-cache',
        user: interaction.user.id
      });
      
      logger.error('Error clearing Twitter cache', { error: error.message });
      await interaction.editReply('An error occurred while clearing the cache.');
    }
  }
};

/**
 * Format an endpoint for display
 * @param {string} endpoint - API endpoint
 * @returns {string} Formatted endpoint name
 */
function formatEndpoint(endpoint) {
  // Replace :id with {id} for better readability
  const formatted = endpoint.replace(/:[a-zA-Z0-9_]+/g, '{id}');
  
  // Shorten very long endpoints
  if (formatted.length > 30) {
    return formatted.substring(0, 27) + '...';
  }
  
  return formatted;
}

/**
 * Create a progress bar based on percentage
 * @param {number} percent - Percentage value
 * @returns {string} Unicode progress bar
 */
function createProgressBar(percent) {
  const fullBlocks = Math.floor(percent / 10);
  let bar = '';
  
  // Add full blocks
  for (let i = 0; i < fullBlocks; i++) {
    bar += '█';
  }
  
  // Add empty blocks
  for (let i = fullBlocks; i < 10; i++) {
    bar += '░';
  }
  
  // Color coding based on usage
  if (percent > 80) {
    return `🔴 ${bar}`; // Red for high usage
  } else if (percent > 50) {
    return `🟠 ${bar}`; // Orange for medium usage
  } else {
    return `🟢 ${bar}`; // Green for low usage
  }
}

/**
 * Get count of Twitter cache entries
 * @returns {number} Number of Twitter cache entries
 */
function getCacheCount() {
  const { defaultCache } = require('../utils/cacheManager');
  
  let count = 0;
  const keys = defaultCache.cache.keys();
  
  for (const key of keys) {
    if (key.startsWith('twitter:')) {
      count++;
    }
  }
  
  return count;
}

// Register command
commandRegistry.register(twitterStatusCommand.name, twitterStatusCommand);
commandRegistry.register('twitter-reset', twitterStatusCommand.resetRateLimits);
commandRegistry.register('twitter-clear-cache', twitterStatusCommand.clearCache);

module.exports = twitterStatusCommand;