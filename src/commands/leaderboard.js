// src/commands/leaderboard.js
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const logger = require('../utils/logger');
const { hasTeamRole } = require('../utils/roleCheck');
const commandRegistry = require('../utils/commandRegistry');
const { captureException } = require('../utils/errorMonitoring');
const { defaultCache } = require('../utils/cacheManager');

/**
 * Leaderboard Command
 */
const leaderboardCommand = {
  name: 'leaderboard',
  description: 'View the top 10 users with the most coins (excluding Team).',
  
  /**
   * Build the leaderboard embed
   * @param {Array} topUsers - Array of user data with membership information
   * @returns {EmbedBuilder} Discord embed for the leaderboard
   */
  buildLeaderboardEmbed(topUsers) {
    // rankEmojis for the top 3
    const rankEmojis = ['🏆', '🥈', '🥉'];

    // Build the leaderboard lines
    const leaderboardLines = topUsers.map(({ userDoc, member }, index) => {
      const rank = rankEmojis[index] || `#${index + 1}`;
      return `${rank} **${member.user.username}** (<@${userDoc.discordId}>) - **${userDoc.coins.toLocaleString()}** coins`;
    });

    // Construct the embed
    const embed = new EmbedBuilder()
      .setTitle('🏅 Leaderboard')
      .setDescription(leaderboardLines.join('\n'))
      .setColor('Gold')
      .setThumbnail('https://static.thenounproject.com/png/5340118-200.png')
      .setFooter({ text: `Last updated: ${new Date().toLocaleString()}` });
      
    return embed;
  },
  
  /**
   * Execute the leaderboard command
   * @param {Object} interaction - Discord interaction
   */
  async execute(interaction) {
    const cmdLog = logger.withContext({ command: 'leaderboard' });
    await interaction.deferReply();

    try {
      // Try to get from cache first (1 minute TTL)
      const cacheKey = `leaderboard:${interaction.guild.id}`;
      
      const cachedEmbed = defaultCache.get(cacheKey);
      if (cachedEmbed) {
        cmdLog.debug('Serving cached leaderboard');
        return interaction.editReply({ embeds: [cachedEmbed] });
      }
      
      // Cache miss - fetch data
      cmdLog.debug('Cache miss, fetching leaderboard data');
      
      // Fetch top users with better query optimization
      const topUsers = await User.find({}, 'discordId username coins', { 
        lean: true,
        sort: { coins: -1 },
        limit: 20 // Fetch more to allow for filtering out Team
      });

      if (!topUsers.length) {
        return interaction.editReply('No leaderboard data available.');
      }

      // More efficient way to handle guild members
      const guildMembersCache = interaction.guild.members.cache;
      const membersToFetch = [];
      
      for (const userDoc of topUsers) {
        if (!guildMembersCache.has(userDoc.discordId)) {
          membersToFetch.push(userDoc.discordId);
        }
      }
      
      // Only fetch what we don't have in cache
      if (membersToFetch.length > 0) {
        cmdLog.debug(`Fetching ${membersToFetch.length} members not in cache`);
        await interaction.guild.members.fetch({ user: membersToFetch });
      }
      
      // Build the final filtered list with member data
      const filtered = [];
      for (const userDoc of topUsers) {
        const member = interaction.guild.members.cache.get(userDoc.discordId);
        
        // Skip if member not found or is a Team member
        if (!member || hasTeamRole(member)) {
          continue;
        }
        
        filtered.push({ userDoc, member });
        if (filtered.length >= 10) break; // Only need top 10
      }

      if (!filtered.length) {
        return interaction.editReply('No leaderboard data available (all top users are Team?).');
      }

      // Build and cache the embed
      const embed = this.buildLeaderboardEmbed(filtered);
      defaultCache.set(cacheKey, embed, 60); // Cache for 1 minute
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      captureException(error, { 
        command: 'leaderboard',
        guild: interaction.guild.id
      });
      
      cmdLog.error('Error in leaderboard command', { error: error.message });
      await interaction.editReply('An error occurred while fetching the leaderboard.');
    }
  }
};

// Register command
commandRegistry.register(leaderboardCommand.name, leaderboardCommand);

module.exports = leaderboardCommand;