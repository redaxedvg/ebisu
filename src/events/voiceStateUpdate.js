// src/events/voiceStateUpdate.js
const { Events } = require('discord.js');
const RadioManager = require('../utils/radioManager');
const { addUserToVoice, removeUserFromVoice } = require('../utils/voiceTracker');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      // Voice aggregator logic
      if (!oldState.channel && newState.channel) {
        // user joined
        addUserToVoice(newState.id, newState.member?.user?.bot);
      } else if (oldState.channel && !newState.channel) {
        // user left
        removeUserFromVoice(oldState.id);
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // user switched channels
        removeUserFromVoice(oldState.id);
        addUserToVoice(newState.id, newState.member?.user?.bot);
      }

      // Auto-radio logic (optional)
      const radioChannelId = process.env.RADIO_CHANNEL_ID;
      if (!radioChannelId) return;

      if (oldState.channelId !== radioChannelId && newState.channelId !== radioChannelId) {
        return;
      }

      const guild = newState.guild;
      const channel = guild.channels.cache.get(radioChannelId);
      if (!channel || channel.type !== 2) return;

      const nonBotMembers = channel.members.filter(m => !m.user.bot);
      const userCount = nonBotMembers.size;

      if (userCount > 0) {
        if (!RadioManager.isRadioPlaying()) {
          logger.info(`Detected user in radio channel "${channel.name}". Starting radio...`);
          await RadioManager.startRadio(guild);
        }
      } else {
        logger.info(`No users left in channel "${channel.name}". Stopping radio...`);
        RadioManager.stopRadio();
      }
    } catch (error) {
      logger.error('Error in voiceStateUpdate:', error);
    }
  },
};