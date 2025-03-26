// src/commands/adminGiveTake.js
const User = require('../models/User');
const checkAdmin = require('../utils/checkAdmin');
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  async giveCoins(interaction) {
    // Check admin
    if (!(await checkAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (!targetUser) {
        return interaction.editReply('User not specified.');
      }
      if (!amount || amount <= 0) {
        return interaction.editReply('Amount must be a positive integer.');
      }

      // Use upsert for atomic increment
      await User.updateOne(
        { discordId: targetUser.id },
        {
          $inc: { coins: amount },
          $setOnInsert: { discordId: targetUser.id, username: targetUser.username },
        },
        { upsert: true }
      );

      await interaction.editReply(`Gave **${amount}** coins to <@${targetUser.id}>.`);
    } catch (error) {
      logger.error('Error in giveCoins:', error);
      interaction.editReply('An error occurred while giving coins.');
    }
  },

  async takeCoins(interaction) {
    // Check admin
    if (!(await checkAdmin(interaction))) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (!targetUser) {
        return interaction.editReply('User not specified.');
      }
      if (!amount || amount <= 0) {
        return interaction.editReply('Amount must be a positive integer.');
      }

      // Update pipeline to ensure balance doesn't go below 0
      await User.findOneAndUpdate(
        { discordId: targetUser.id },
        [
          {
            $set: {
              discordId: { $ifNull: ['$discordId', targetUser.id] },
              username: { $ifNull: ['$username', targetUser.username] },
              coins: {
                $cond: {
                  if: { $lt: [{ $ifNull: ['$coins', 0] }, amount] },
                  then: 0,
                  else: { $subtract: [{ $ifNull: ['$coins', 0] }, amount] },
                },
              },
            },
          },
        ],
        { new: true, upsert: true }
      );

      await interaction.editReply(`Took **${amount}** coins from <@${targetUser.id}>.`);
    } catch (error) {
      logger.error('Error in takeCoins:', error);
      interaction.editReply('An error occurred while taking coins.');
    }
  },
};