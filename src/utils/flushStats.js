// src/utils/flushStats.js
const User = require('../models/User');
const { userStatsAccumulator } = require('./aggregator');
const checkMilestones = require('./milestoneCheck');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

async function flushStatsToDB() {
  if (userStatsAccumulator.size === 0) {
    return; // Nothing to flush
  }

  try {
    const bulkOps = [];
    const updatedDiscordIds = [];

    for (const [discordId, increments] of userStatsAccumulator.entries()) {
      const incFields = {};

      if (increments.messagesCount > 0) {
        incFields.messagesCount = increments.messagesCount;
      }
      if (increments.reactionsCount > 0) {
        incFields.reactionsCount = increments.reactionsCount;
      }
      if (increments.voiceMinutes > 0) {
        incFields.voiceMinutes = increments.voiceMinutes;
      }
      // add other fields as needed

      if (Object.keys(incFields).length === 0) continue;

      bulkOps.push({
        updateOne: {
          filter: { discordId },
          update: {
            $inc: incFields,
            $setOnInsert: { discordId },
          },
          upsert: true,
        },
      });
      updatedDiscordIds.push(discordId);
    }

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
      logger.info(`Flushed ${bulkOps.length} user stat update(s) to DB.`);

      // Now fetch updated docs to run milestone checks
      const updatedUsers = await User.find({ discordId: { $in: updatedDiscordIds } });
      for (const userDoc of updatedUsers) {
        await checkMilestones(userDoc);
      }
    }

    userStatsAccumulator.clear();
  } catch (error) {
    logger.error('Error flushing stats to DB:', error);
  }
}

module.exports = flushStatsToDB;