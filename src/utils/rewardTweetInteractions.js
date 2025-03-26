// src/utils/rewardTweetInteractions.js
const User = require('../models/User');
const logger = require('./logger');
const { captureException } = require('./errorMonitoring');

/**
 * Reward Tweet Interactions System
 * Manages giving coins to users who interact with tweets
 */
class RewardManager {
  constructor() {
    this.contextLog = logger.withContext({ module: 'RewardManager' });
    
    // Default reward values
    this.rewards = {
      like: 1,
      retweet: 1
    };
  }
  
  /**
   * Process rewards for tweet interactions
   * @param {Object} tweet - Tweet document from database
   * @param {Array} newLikedIds - Array of Twitter IDs that liked the tweet
   * @param {Array} newRetweetIds - Array of Twitter IDs that retweeted the tweet
   * @returns {Promise<number>} Number of new rewards given
   */
  async processTweetInteractions(tweet, newLikedIds = [], newRetweetIds = []) {
    try {
      // Update arrays in tweet document
      tweet.likedUserIds = Array.from(new Set([...tweet.likedUserIds, ...newLikedIds]));
      tweet.retweetedUserIds = Array.from(new Set([...tweet.retweetedUserIds, ...newRetweetIds]));
      
      // No new interactions to process
      if (newLikedIds.length === 0 && newRetweetIds.length === 0) {
        return this.checkMissingRewards(tweet);
      }
      
      const allIds = [...newLikedIds, ...newRetweetIds];
      const matchedUsers = await User.find({ twitterId: { $in: allIds } });
      
      this.contextLog.debug('Processing tweet interactions', {
        tweetId: tweet.tweetId,
        newLikes: newLikedIds.length,
        newRetweets: newRetweetIds.length,
        matchedUsers: matchedUsers.length
      });
      
      let totalNewRewards = 0;
      const rewardPromises = [];
      
      for (const userDoc of matchedUsers) {
        const rewards = await this.rewardUser(userDoc, tweet, newLikedIds, newRetweetIds);
        totalNewRewards += rewards.total;
        rewardPromises.push(rewards.savePromise);
      }
      
      // Wait for all rewards to be saved
      await Promise.all(rewardPromises);
      
      // Ensure arrays have unique values
      tweet.rewardedForLikes = Array.from(new Set(tweet.rewardedForLikes));
      tweet.rewardedForRetweets = Array.from(new Set(tweet.rewardedForRetweets));
      
      // Mark modified arrays to ensure they're saved
      tweet.markModified('likedUserIds');
      tweet.markModified('retweetedUserIds');
      tweet.markModified('rewardedForLikes');
      tweet.markModified('rewardedForRetweets');
      
      return totalNewRewards;
    } catch (error) {
      captureException(error, {
        area: 'tweet-rewards',
        tweetId: tweet.tweetId
      });
      
      this.contextLog.error('Error processing tweet interactions', {
        error: error.message,
        tweetId: tweet.tweetId
      });
      
      throw error;
    }
  }
  
  /**
   * Reward an individual user for tweet interactions
   * @param {Object} userDoc - User document
   * @param {Object} tweet - Tweet document
   * @param {Array} newLikedIds - Array of Twitter IDs that liked
   * @param {Array} newRetweetIds - Array of Twitter IDs that retweeted
   * @returns {Object} Reward results and save promise
   */
  async rewardUser(userDoc, tweet, newLikedIds, newRetweetIds) {
    let rewardApplied = false;
    let likeRewarded = false;
    let retweetRewarded = false;
    
    // Check if user liked the tweet and hasn't been rewarded yet
    if (
      newLikedIds.includes(userDoc.twitterId) && 
      !tweet.rewardedForLikes.includes(userDoc.discordId)
    ) {
      userDoc.coins += this.rewards.like;
      userDoc.totalLikes += 1;
      tweet.rewardedForLikes.push(userDoc.discordId);
      rewardApplied = true;
      likeRewarded = true;
    }
    
    // Check if user retweeted and hasn't been rewarded yet
    if (
      newRetweetIds.includes(userDoc.twitterId) && 
      !tweet.rewardedForRetweets.includes(userDoc.discordId)
    ) {
      userDoc.coins += this.rewards.retweet;
      userDoc.totalRetweets += 1;
      tweet.rewardedForRetweets.push(userDoc.discordId);
      rewardApplied = true;
      retweetRewarded = true;
    }
    
    // Log rewards for auditing
    if (rewardApplied) {
      this.contextLog.info('Rewarded user for tweet interaction', {
        tweetId: tweet.tweetId,
        userId: userDoc.discordId,
        twitterId: userDoc.twitterId,
        likeRewarded,
        retweetRewarded
      });
      
      // Return both the counts and the save promise
      return {
        total: (likeRewarded ? 1 : 0) + (retweetRewarded ? 1 : 0),
        likeRewarded,
        retweetRewarded,
        savePromise: userDoc.save()
      };
    }
    
    // No rewards given
    return {
      total: 0,
      likeRewarded: false,
      retweetRewarded: false,
      savePromise: Promise.resolve()
    };
  }
  
  /**
   * Check for missing rewards in a tweet
   * @param {Object} tweet - Tweet document
   * @returns {Promise<number>} Number of new rewards given
   */
  async checkMissingRewards(tweet) {
    // Find users who interacted but haven't been rewarded
    const likedNotRewarded = tweet.likedUserIds.filter(twitterId => {
      // For each Twitter ID, check if any Discord user with this Twitter ID
      // has been rewarded by checking if their Discord ID is in rewardedForLikes
      return true; // This is simplified - we need actual mapping
    });
    
    const retweetedNotRewarded = tweet.retweetedUserIds.filter(twitterId => {
      // Similar check for retweets
      return true; // This is simplified - we need actual mapping
    });
    
    if (likedNotRewarded.length === 0 && retweetedNotRewarded.length === 0) {
      return 0;
    }
    
    // Find users who have linked their Twitter account
    const allTwitterIds = [...new Set([...likedNotRewarded, ...retweetedNotRewarded])];
    const matchedUsers = await User.find({ twitterId: { $in: allTwitterIds } });
    
    let totalRewards = 0;
    const rewardPromises = [];
    
    for (const userDoc of matchedUsers) {
      // Check like rewards
      if (
        likedNotRewarded.includes(userDoc.twitterId) && 
        !tweet.rewardedForLikes.includes(userDoc.discordId)
      ) {
        userDoc.coins += this.rewards.like;
        userDoc.totalLikes += 1;
        tweet.rewardedForLikes.push(userDoc.discordId);
        totalRewards++;
      }
      
      // Check retweet rewards
      if (
        retweetedNotRewarded.includes(userDoc.twitterId) && 
        !tweet.rewardedForRetweets.includes(userDoc.discordId)
      ) {
        userDoc.coins += this.rewards.retweet;
        userDoc.totalRetweets += 1;
        tweet.rewardedForRetweets.push(userDoc.discordId);
        totalRewards++;
      }
      
      // Save if rewards were given
      if (userDoc.isModified()) {
        rewardPromises.push(userDoc.save());
      }
    }
    
    // Wait for all saves to complete
    await Promise.all(rewardPromises);
    
    // Ensure arrays have unique values
    tweet.rewardedForLikes = Array.from(new Set(tweet.rewardedForLikes));
    tweet.rewardedForRetweets = Array.from(new Set(tweet.rewardedForRetweets));
    
    // Mark arrays as modified
    tweet.markModified('rewardedForLikes');
    tweet.markModified('rewardedForRetweets');
    
    this.contextLog.info('Processed missing rewards', {
      tweetId: tweet.tweetId,
      rewardsGiven: totalRewards
    });
    
    return totalRewards;
  }
  
  /**
   * Set reward amounts
   * @param {Object} rewards - Reward configuration
   */
  setRewards(rewards) {
    if (rewards.like !== undefined) {
      this.rewards.like = rewards.like;
    }
    
    if (rewards.retweet !== undefined) {
      this.rewards.retweet = rewards.retweet;
    }
    
    this.contextLog.info('Updated reward amounts', { rewards: this.rewards });
  }
}

// Create singleton instance
const rewardManager = new RewardManager();

// Main export function for backward compatibility
async function rewardTweetInteractions(tweet, newLikedIds = [], newRetweetIds = []) {
  return rewardManager.processTweetInteractions(tweet, newLikedIds, newRetweetIds);
}

module.exports = rewardTweetInteractions;
module.exports.rewardManager = rewardManager;