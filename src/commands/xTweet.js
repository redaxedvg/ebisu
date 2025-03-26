// src/commands/xTweet.js
const { PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const Tweet = require('../models/Tweet');
const twitterClient = require('../utils/twitterClient');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Post tweet content to the Discord channel
 */
async function postTweetToDiscord(channel, username, latestTweet, tweetPostedAt) {
  const twoDaysLaterUnix = Math.floor((tweetPostedAt.getTime() + TWO_DAYS_MS) / 1000);
  const discordTimestamp = `<t:${twoDaysLaterUnix}:R>`; // e.g. "in 2 days"

  const contentMessage = `**${username}** just posted a Tweet!\n\n**Engage to earn coins\nUntil ${discordTimestamp}**\n\nhttps://x.com/${username}/status/${latestTweet.id}`;

  // Attach local pfp and footer images
  const pfpAttachment = new AttachmentBuilder(path.join(__dirname, '../assets/twitterpfp.png'), { name: 'twitterpfp.png' });
  const footerAttachment = new AttachmentBuilder(path.join(__dirname, '../assets/Intersect.png'), { name: 'Intersect.png' });

  const embed = new EmbedBuilder()
    .setAuthor({ name: username, iconURL: 'attachment://twitterpfp.png' })
    .setTitle(`@${username}`)
    .setURL(`https://x.com/${username}`)
    .setDescription(latestTweet.text || '')
    .setColor('Blue');

  if (latestTweet.imageUrl) {
    embed.setImage(latestTweet.imageUrl);
  }
  embed.setFooter({ text: 'Powered by Ador', iconURL: 'attachment://Intersect.png' });

  const likeButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setEmoji('1339231752698204162')
    .setURL(`https://x.com/intent/like?tweet_id=${latestTweet.id}`);

  const rtButton = new ButtonBuilder()
    .setLabel('Retweet')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://x.com/intent/retweet?tweet_id=${latestTweet.id}`);

  const row = new ActionRowBuilder().addComponents(likeButton, rtButton);

  return channel.send({
    content: contentMessage,
    embeds: [embed],
    components: [row],
    files: [pfpAttachment, footerAttachment],
  });
}

module.exports = {
  name: 'x-tweet',
  description: 'Check if the specified Twitter/X account has a new Tweet and post it.',
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'No permission.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const { TWITTER_ACCOUNT_ID, TWITTER_POST_CHANNEL_ID } = process.env;
    
    try {
      // Get user info using rate-limited client
      const userResponse = await twitterClient.getUserByUsername(TWITTER_ACCOUNT_ID);
      if (!userResponse.data) {
        return interaction.editReply('Could not fetch Twitter account information.');
      }
      
      const username = userResponse.data.username;
      
      // Get latest tweets using rate-limited client
      const tweetsResponse = await twitterClient.getUserTweets(TWITTER_ACCOUNT_ID);
      if (!tweetsResponse.data || tweetsResponse.data.length === 0) {
        return interaction.editReply('No recent Tweets found.');
      }
      
      // Process the response
      const latestTweet = tweetsResponse.data[0];
      
      // Check for media
      let tweetImageUrl = null;
      if (tweetsResponse.includes?.media?.length) {
        const media = tweetsResponse.includes.media.find(m => m.type === 'photo');
        if (media) {
          tweetImageUrl = media.url;
        }
      }
      
      // Add image URL to tweet data
      latestTweet.imageUrl = tweetImageUrl;
      
      // Check if we've already posted this tweet
      const existingTweet = await Tweet.findOne({ tweetId: latestTweet.id });
      if (existingTweet) {
        return interaction.editReply('No new Tweet to post.');
      }

      // Get the Discord channel
      const channel = await interaction.client.channels.fetch(TWITTER_POST_CHANNEL_ID);
      if (!channel?.isTextBased()) {
        return interaction.editReply('Invalid channel for posting Tweets.');
      }
      if (!channel.permissionsFor(interaction.client.user)?.has(PermissionsBitField.Flags.SendMessages)) {
        return interaction.editReply('Bot lacks permission to send messages in the target channel.');
      }

      const tweetPostedAt = new Date();
      const sentMessage = await postTweetToDiscord(channel, username, latestTweet, tweetPostedAt);

      await Tweet.create({
        tweetId: latestTweet.id,
        postedAt: tweetPostedAt,
        finalChecked: false,
        discordMessageId: sentMessage.id,
      });

      return interaction.editReply('Latest Tweet posted!');
    } catch (error) {
      // Handle rate limit errors specifically
      if (error.message && error.message.includes('Rate limit exceeded')) {
        const endpoint = error.message.split('Rate limit exceeded for ')[1]?.split('.')[0] || 'Twitter API';
        return interaction.editReply(
          `Twitter API rate limit reached for ${endpoint}. Please try again later.`
        );
      }
      
      logger.error('Error in x-tweet command:', error);
      return interaction.editReply('Error fetching or posting Tweet.');
    }
  },
};