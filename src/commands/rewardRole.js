// src/commands/rewardRole.js
const { PermissionsBitField } = require('discord.js');
const RewardRole = require('../models/RewardRole');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'rewardrole',
  description: 'Add or update a role reward in the database. (Admin only)',
  async execute(interaction) {
    // Check if user has Administrator permission
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: 'You need administrator permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Retrieve the selected role and the amount of coins
      const role = interaction.options.getRole('role', true);
      const amount = interaction.options.getInteger('amount', true);

      if (amount <= 0) {
        return interaction.editReply('Reward amount must be a positive integer.');
      }

      // Upsert the reward role in the DB
      const rewardRole = await RewardRole.findOneAndUpdate(
        { roleId: role.id },
        { reward: amount },
        { new: true, upsert: true }
      );

      logger.info(`Set reward for role ${role.id} to ${amount} coins.`);
      return interaction.editReply(
        `Successfully set reward for role <@&${role.id}> to **${amount}** coin(s).`
      );
    } catch (error) {
      logger.error('Error in rewardRole command:', error);
      return interaction.editReply('An error occurred while setting the role reward.');
    }
  },
};