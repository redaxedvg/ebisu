// src/events/interactionCreate.js
const { Events } = require('discord.js');
const gmCommand = require('../commands/gm');
const xTweetCommand = require('../commands/xTweet');
const xInteractionCommand = require('../commands/xInteraction');
const linkXCommand = require('../commands/linkX');
const leaderboardCommand = require('../commands/leaderboard');
const statsCommand = require('../commands/stats');
const marketplaceMain = require('../commands/marketplace');
const { giveCoins, takeCoins } = require('../commands/adminGiveTake');
const { resetLeaderboard, resetStats } = require('../commands/adminReset');
const winston = require('winston');
const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // Commands
        if (commandName === 'gm') return gmCommand.execute(interaction);
        if (commandName === 'x-tweet') return xTweetCommand.execute(interaction);
        if (commandName === 'x-interaction') return xInteractionCommand.execute(interaction);
        if (commandName === 'link-x') return linkXCommand.execute(interaction);
        if (commandName === 'leaderboard') return leaderboardCommand.execute(interaction);
        if (commandName === 'stats') return statsCommand.execute(interaction);

        if (commandName === 'marketplace') return marketplaceMain.execute(interaction);
        if (commandName === 'add-marketplace') return marketplaceMain.addMarketplace(interaction);
        if (commandName === 'remove-marketplace') return marketplaceMain.removeMarketplace(interaction);
        if (commandName === 'edit-marketplace') return marketplaceMain.editMarketplace(interaction);

        if (commandName === 'give-coins') return giveCoins(interaction);
        if (commandName === 'take-coins') return takeCoins(interaction);
        if (commandName === 'reset-leaderboard') return resetLeaderboard(interaction);
        if (commandName === 'reset-stats') return resetStats(interaction);

      } else if (interaction.isButton()) {
        // Marketplace purchase
        if (interaction.customId.startsWith('purchase_')) {
          await interaction.deferReply({ ephemeral: true });
          try {
            const itemId = interaction.customId.split('_')[1];
            const item = await MarketplaceItem.findById(itemId);
            if (!item) {
              return interaction.editReply('This item no longer exists.');
            }

            let userDoc = await User.findOneAndUpdate(
              { discordId: interaction.user.id },
              { $setOnInsert: { username: interaction.user.username } },
              { new: true, upsert: true }
            );

            if (userDoc.coins < item.price) {
              const diff = item.price - userDoc.coins;
              return interaction.editReply(`You need **${diff}** more coins to buy **${item.name}**.`);
            }

            userDoc.coins -= item.price;
            await userDoc.save();

            const role = interaction.guild.roles.cache.get(item.roleId);
            if (!role) {
              return interaction.editReply(`The role for **${item.name}** no longer exists.`);
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            await member.roles.add(role);

            await interaction.editReply(`You purchased **${item.name}** and received **${role.name}**!`);

            // Announce if desired
            const announceChannelId = process.env.MARKETPLACE_ANNOUNCE_CHANNEL;
            if (announceChannelId) {
              try {
                const announceChannel = await interaction.client.channels.fetch(announceChannelId);
                if (announceChannel?.isTextBased()) {
                  await announceChannel.send(`Congratulations, **<@${interaction.user.id}>** became ${role}`);
                }
              } catch (e) {
                logger.error('Failed to send marketplace announcement:', e);
              }
            }
          } catch (err) {
            logger.error('Error processing marketplace purchase button:', err);
            interaction.editReply('An error occurred while processing your purchase.');
          }
        }
      }
    } catch (error) {
      logger.error('Error in interactionCreate event:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply('An error occurred while processing this interaction.');
      } else {
        await interaction.reply({ content: 'An error occurred while processing this interaction.', ephemeral: true });
      }
    }
  },
};