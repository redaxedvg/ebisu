// src/commands/linkX.js
const User = require('../models/User');
const twitterClient = require('../utils/twitterClient');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'link-x',
  description: 'Link your Twitter/X account to your Discord user',
  async execute(interaction) {
    try {
      const inputUsername = interaction.options.getString('username')?.trim();
      if (!inputUsername) {
        return interaction.reply({ content: 'You must provide a Twitter username.', ephemeral: true });
      }
      const username = inputUsername.replace(/^@/, '');

      await interaction.deferReply({ ephemeral: true });

      // Upsert the user
      let userDoc = await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        {
          $setOnInsert: { username: interaction.user.username },
        },
        { new: true, upsert: true }
      );

      if (userDoc.twitterId) {
        const connectedUsername = userDoc.twitterUsername ? `@${userDoc.twitterUsername}` : 'your Twitter account';
        return interaction.editReply(`You have already connected ${connectedUsername}.`);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_yes')
          .setLabel('Yes')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('confirm_no')
          .setLabel('No')
          .setStyle(ButtonStyle.Danger)
      );

      const confirmationMessage = await interaction.editReply({
        content: `Is this the correct account: https://x.com/${username}?`,
        components: [row]
      });

      let buttonInteraction;
      try {
        const filter = (i) => i.user.id === interaction.user.id;
        buttonInteraction = await confirmationMessage.awaitMessageComponent({
          filter,
          componentType: ComponentType.Button,
          time: 15000
        });
      } catch {
        return interaction.editReply({ content: 'No response received. Please try again.', components: [] });
      }

      if (buttonInteraction.customId === 'confirm_no') {
        await buttonInteraction.reply({ content: 'Please try again with the correct account.', ephemeral: true });
        await interaction.editReply({ components: [] });
        return;
      }

      // Acknowledge "Yes" click
      await buttonInteraction.update({ components: [] });

      try {
        // Twitter API call using rate-limited client
        const response = await twitterClient.getUserByUsername(username);
        
        const twitterUser = response.data;
        if (!twitterUser) {
          return interaction.followUp({ content: `Could not find Twitter user @${username}.`, ephemeral: true });
        }

        userDoc.twitterId = twitterUser.id;
        userDoc.twitterUsername = username;
        await userDoc.save();

        return interaction.followUp({ content: `Successfully linked your account to @${username}.`, ephemeral: true });
      } catch (error) {
        // Handle rate limit errors specifically
        if (error.message && error.message.includes('Rate limit exceeded')) {
          return interaction.followUp({ 
            content: 'Twitter API rate limit reached. Please try again in a few minutes.', 
            ephemeral: true 
          });
        }
        
        throw error; // Re-throw for general error handling
      }
    } catch (err) {
      logger.error('Error linking Twitter account:', err);
      return interaction.followUp({ content: 'Error linking your Twitter username.', ephemeral: true });
    }
  },
};