// src/scheduler.js
const cron = require('node-cron');
const checkFinalInteractions = require('./checkFinalInteractions');
const checkMissingRewards = require('./checkMissingRewards');
const flushStatsToDB = require('./utils/flushStats');
const { getUsersInVoice } = require('./utils/voiceTracker');
const { accumulateUserStat } = require('./utils/aggregator');
const twitterClient = require('./utils/twitterClient');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

// 1) Final check job (staggered to every 16 minutes to manage rate limits)
cron.schedule('*/16 * * * *', async () => {
  try {
    // Check Twitter API rate limits before proceeding
    const likingUsersStatus = twitterClient.getRateLimitStatus('/2/tweets/:id/liking_users');
    const retweetedByStatus = twitterClient.getRateLimitStatus('/2/tweets/:id/retweeted_by');
    
    // Only proceed if we have enough requests available (at least 50% remaining)
    if (likingUsersStatus.isLimited || 
        retweetedByStatus.isLimited ||
        likingUsersStatus.currentCount > likingUsersStatus.limit * 0.5 ||
        retweetedByStatus.currentCount > retweetedByStatus.limit * 0.5) {
      logger.warn('[Scheduler] Skipping final check job due to Twitter API rate limit concerns', {
        likingUsers: `${likingUsersStatus.currentCount}/${likingUsersStatus.limit}`,
        retweetedBy: `${retweetedByStatus.currentCount}/${retweetedByStatus.limit}`
      });
      return;
    }
    
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

// 5) Twitter API rate limit reset job (resets every 15 minutes per Twitter API window)
cron.schedule('0,15,30,45 * * * *', () => {
  try {
    // Log current rate limit status before reset
    const statuses = twitterClient.getAllRateLimitStatuses();
    const highUsageEndpoints = statuses.filter(s => 
      (s.currentCount / s.limit) > 0.7
    );
    
    if (highUsageEndpoints.length > 0) {
      logger.info('[Scheduler] Twitter API endpoints with high usage before auto-reset:', {
        endpoints: highUsageEndpoints.map(s => 
          `${s.endpoint}: ${s.currentCount}/${s.limit} (${Math.round((s.currentCount/s.limit)*100)}%)`
        )
      });
    }
    
    // Reset internal counters when the Twitter API window resets
    twitterClient.resetRateLimitCounters();
    logger.info('[Scheduler] Reset Twitter API rate limit counters');
  } catch (err) {
    logger.error('[Scheduler] Error resetting Twitter API rate limit counters:', err);
  }
});