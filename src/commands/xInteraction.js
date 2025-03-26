// src/commands/xInteraction.js
const { PermissionsBitField } = require('discord.js');
const Tweet = require('../models/Tweet');
const rewardTweetInteractions = require('../utils/rewardTweetInteractions');
const twitterClient = require('../utils/twitterClient');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'x-interaction',
  description: 'Manually check for likes/retweets on a specified Tweet within the time limit.',
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const tweetId = interaction.options.getString('tweetid');
      if (!tweetId) {
        return interaction.editReply('Please provide a Tweet ID to check.');
      }

      const tweet = await Tweet.findOne({ tweetId });
      if (!tweet) {
        return interaction.editReply(`No tweet found with ID: ${tweetId}`);
      }

      try {
        // Fetch new liking/retweeting users using rate-limited client
        const [likingData, retweetData] = await Promise.all([
          twitterClient.getTweetLikingUsers(tweet.tweetId),
          twitterClient.getTweetRetweetingUsers(tweet.tweetId),
        ]);

        const newLikedIds = (likingData?.data || []).map(u => u.id);
        const newRetweetIds = (retweetData?.data || []).map(u => u.id);

        // Reward them
        const totalNewRewards = await rewardTweetInteractions(tweet, newLikedIds, newRetweetIds);

        // Save tweet
        tweet.markModified('likedUserIds');
        tweet.markModified('retweetedUserIds');
        await tweet.save();

        return interaction.editReply(
          `Checked interactions on tweet ID: ${tweetId}. New rewards: **${totalNewRewards}**`
        );
      } catch (error) {
        // Handle rate limit errors specifically
        if (error.message && error.message.includes('Rate limit exceeded')) {
          const endpoint = error.message.split('Rate limit exceeded for ')[1]?.split('.')[0] || 'Twitter API';
          return interaction.editReply(
            `Twitter API rate limit reached for ${endpoint}. Please try again later.`
          );
        }
        
        throw error; // Re-throw for general error handling
      }
    } catch (err) {
      logger.error('Error checking x-interaction:', err);
      return interaction.editReply('Error occurred checking interactions.');
    }
  },
};