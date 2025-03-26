// src/utils/rewardTweetInteractions.js
const User = require('../models/User');

/**
 * rewardTweetInteractions(tweet, newLikedIds, newRetweetIds)
 * Merges new user IDs into tweet.likedUserIds/retweetedUserIds,
 * finds matching users, and awards coins if not already rewarded.
 * Returns the total number of new rewards given.
 */
async function rewardTweetInteractions(tweet, newLikedIds = [], newRetweetIds = []) {
  tweet.likedUserIds = Array.from(new Set([...tweet.likedUserIds, ...newLikedIds]));
  tweet.retweetedUserIds = Array.from(new Set([...tweet.retweetedUserIds, ...newRetweetIds]));

  const allIds = [...newLikedIds, ...newRetweetIds];
  const matchedUsers = await User.find({ twitterId: { $in: allIds } });

  let totalNewRewards = 0;
  for (const userDoc of matchedUsers) {
    let rewardApplied = false;

    if (newLikedIds.includes(userDoc.twitterId) && !tweet.rewardedForLikes.includes(userDoc.discordId)) {
      userDoc.coins += 1;
      userDoc.totalLikes += 1;
      tweet.rewardedForLikes.push(userDoc.discordId);
      rewardApplied = true;
    }

    if (newRetweetIds.includes(userDoc.twitterId) && !tweet.rewardedForRetweets.includes(userDoc.discordId)) {
      userDoc.coins += 1;
      userDoc.totalRetweets += 1;
      tweet.rewardedForRetweets.push(userDoc.discordId);
      rewardApplied = true;
    }

    if (rewardApplied) {
      await userDoc.save();
      totalNewRewards++;
    }
  }

  tweet.rewardedForLikes = Array.from(new Set(tweet.rewardedForLikes));
  tweet.rewardedForRetweets = Array.from(new Set(tweet.rewardedForRetweets));

  return totalNewRewards;
}

module.exports = rewardTweetInteractions;