// src/events/messageCreate.js
const { Events } = require('discord.js');
const { accumulateUserStat } = require('../utils/aggregator');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (message.author.bot) return;
      // Accumulate stats
      accumulateUserStat(message.author.id, 'messagesCount', 1);
    } catch (error) {
      logger.error('Error in messageCreate:', error);
    }
  },
};