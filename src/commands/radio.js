// src/commands/radio.js
const { PermissionsBitField } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const RadioManager = require('../utils/radioManager');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'radio',
  description: 'Manage the 24/7 radio feature',
  async execute(interaction) {
    // Admin check (optional, if you only want Admins to start/stop)
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      // Check if user is in a voice channel
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        return interaction.reply({
          content: 'You must be in a voice channel to start the radio!',
          ephemeral: true,
        });
      }

      // Defer reply so we can connect asynchronously
      await interaction.deferReply({ ephemeral: true });

      try {
        // Attempt to start the radio in the user’s voice channel
        await RadioManager.startRadio(voiceChannel);
        await interaction.editReply(`Radio started in **${voiceChannel.name}**. Enjoy the music!`);
      } catch (err) {
        logger.error('Error starting radio:', err);
        await interaction.editReply('Failed to start the radio. Check logs.');
      }
    } 
    else if (subcommand === 'stop') {
      await interaction.deferReply({ ephemeral: true });
      try {
        RadioManager.stopRadio();
        await interaction.editReply('Radio has been stopped and the bot is disconnected.');
      } catch (err) {
        logger.error('Error stopping radio:', err);
        await interaction.editReply('Failed to stop the radio. Check logs.');
      }
    }
  }
};