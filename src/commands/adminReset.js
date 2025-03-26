// src/commands/adminReset.js
const User = require('../models/User');
const checkAdmin = require('../utils/checkAdmin');
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  async resetLeaderboard(interaction) {
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await User.updateMany({}, { coins: 0 });
      logger.info(`resetLeaderboard: Updated ${result.modifiedCount} user(s) to coins=0.`);
      interaction.editReply('Leaderboard reset (coins=0).');
    } catch (error) {
      logger.error('Error in resetLeaderboard:', error);
      interaction.editReply('An error occurred while resetting the leaderboard.');
    }
  },

  async resetStats(interaction) {
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await User.updateMany({}, {
        messagesCount: 0,
        reactionsCount: 0,
        voiceMinutes: 0,
        coins: 0,
        totalLikes: 0,
        totalRetweets: 0,
      });
      logger.info(`resetStats: Updated ${result.modifiedCount} user(s) with reset stats.`);
      interaction.editReply('All user stats have been reset.');
    } catch (error) {
      logger.error('Error in resetStats:', error);
      interaction.editReply('An error occurred while resetting user stats.');
    }
  },
};