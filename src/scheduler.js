// src/scheduler.js
const cron = require('node-cron');
const checkFinalInteractions = require('./checkFinalInteractions');
const checkMissingRewards = require('./checkMissingRewards');
const flushStatsToDB = require('./utils/flushStats');
const { getUsersInVoice } = require('./utils/voiceTracker');
const { accumulateUserStat } = require('./utils/aggregator');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

// 1) Final check job (every 16 minutes)
cron.schedule('*/16 * * * *', async () => {
  try {
    await checkFinalInteractions();
  } catch (err) {
    logger.error('[Scheduler] Error during final check run:', err);
  }
});

// 2) Missing rewards job (every 30 minutes)
cron.schedule('*/30 * * * *', async () => {
  try {
    await checkMissingRewards();
  } catch (err) {
    logger.error('[Scheduler] Error during missing rewards check run:', err);
  }
});

// 3) Flush stats every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    await flushStatsToDB();
  } catch (err) {
    logger.error('Error flushing user stats:', err);
  }
});

// 4) Increment voice minutes every 1 minute
cron.schedule('* * * * *', async () => {
  try {
    const inVoice = getUsersInVoice();
    // For each user in voice, increment aggregator voiceMinutes by 1
    for (const discordId of inVoice) {
      accumulateUserStat(discordId, 'voiceMinutes', 1);
    }
  } catch (err) {
    logger.error('Error incrementing voice minutes:', err);
  }
});