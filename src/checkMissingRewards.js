// src/checkMissingRewards.js
const Tweet = require('./models/Tweet');
const rewardTweetInteractions = require('./utils/rewardTweetInteractions');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

/**
 * checkMissingRewards()
 *
 * Scans all tweets for any user IDs not yet rewarded,
 * then awards them. Uses local arrays in Tweet docs only (no Twitter API call).
 */
async function checkMissingRewards() {
  try {
    logger.info('[Scheduler] Checking for missing rewards in all tweets.');

    const allTweets = await Tweet.find({});
    let totalRewardsGiven = 0;

    for (const tweet of allTweets) {
      // Combine existing arrays
      const newLikedIds = []; // We'll pass empty because we're not adding new IDs
      const newRetweetIds = [];
      // But we do a final pass to ensure that any user in likedUserIds/retweetedUserIds 
      // is rewarded if not in rewardedForLikes/rewardedForRetweets.

      const rewardsForThisTweet = await rewardTweetInteractions(tweet, newLikedIds, newRetweetIds);
      if (rewardsForThisTweet > 0) {
        await tweet.save();
      }
      totalRewardsGiven += rewardsForThisTweet;
    }

    logger.info(`[Scheduler] Missing rewards check complete. Total new rewards given: ${totalRewardsGiven}`);
  } catch (err) {
    logger.error('[Scheduler] checkMissingRewards() error:', err);
  }
}

module.exports = checkMissingRewards;