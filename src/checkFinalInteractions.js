// src/checkFinalInteractions.js
const Tweet = require('./models/Tweet');
const twitterClient = require('./utils/twitterClient');
const rewardTweetInteractions = require('./utils/rewardTweetInteractions');
const { EmbedBuilder } = require('discord.js');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

async function checkFinalInteractions() {
  try {
    logger.info('[Scheduler] Starting final check of tweets older than 2 days.');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const pendingTweets = await Tweet.find({
      postedAt: { $lte: twoDaysAgo },
      finalChecked: { $ne: true },
    }).limit(10); // or more if you like

    let totalProcessed = 0;

    for (const tweet of pendingTweets) {
      try {
        // Use rate-limited Twitter client
        const [likingData, retweetData] = await Promise.all([
          twitterClient.getTweetLikingUsers(tweet.tweetId),
          twitterClient.getTweetRetweetingUsers(tweet.tweetId),
        ]);

        const newLikedIds = (likingData?.data || []).map(u => u.id);
        const newRetweetIds = (retweetData?.data || []).map(u => u.id);

        // Reward them
        const newRewards = await rewardTweetInteractions(tweet, newLikedIds, newRetweetIds);
        tweet.finalChecked = true;
        await tweet.save();

        totalProcessed++;

        // If there's a Discord message, update it
        if (tweet.discordMessageId && global.discordClient) {
          try {
            const channel = await global.discordClient.channels.fetch(process.env.TWITTER_POST_CHANNEL_ID);
            if (channel?.isTextBased()) {
              const message = await channel.messages.fetch(tweet.discordMessageId);
              if (message) {
                const appendedText = "\n**Coins have been distributed.**";
                if (message.embeds.length > 0) {
                  let embed = EmbedBuilder.from(message.embeds[0]);
                  const newDescription = (embed.data.description || "") + appendedText;
                  embed.setDescription(newDescription);
                  await message.edit({ embeds: [embed] });
                } else {
                  await message.edit({ content: message.content + appendedText });
                }
              }
            }
          } catch (updateError) {
            logger.error('Error updating tweet message after final check:', updateError);
          }
        }
      } catch (err) {
        // Check for rate limit errors
        if (err.message && err.message.includes('Rate limit exceeded')) {
          logger.warn(`[Scheduler] Twitter API rate limit reached while processing tweet ID=${tweet.tweetId}. Skipping for now.`);
          continue; // Skip this tweet and try the next one
        }
        
        logger.error(`Error processing tweet ID=${tweet.tweetId}:`, err);
      }
    }

    logger.info(`[Scheduler] Final check complete. Processed ${totalProcessed} tweet(s).`);
  } catch (err) {
    logger.error('[Scheduler] checkFinalInteractions() error:', err);
  }
}

module.exports = checkFinalInteractions;