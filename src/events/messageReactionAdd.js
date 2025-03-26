// src/events/messageReactionAdd.js
const { Events } = require('discord.js');
const { accumulateUserStat } = require('../utils/aggregator');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    try {
      if (user.bot) return;
      accumulateUserStat(user.id, 'reactionsCount', 1);
    } catch (error) {
      logger.error('Error in messageReactionAdd:', error);
    }
  },
};