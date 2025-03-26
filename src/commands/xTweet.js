// src/commands/x-tweet.js
const { PermissionsBitField, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const path = require('path');
const Tweet = require('../models/Tweet');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
let cachedUsername = null;
let lastUserFetchTime = 0;

/**
 * Fetch username with 2-day caching to minimize calls
 */
async function fetchTwitterUsername(accountId, bearerToken) {
  const now = Date.now();
  if (cachedUsername && now - lastUserFetchTime <= TWO_DAYS_MS) {
    return cachedUsername;
  }
  const userUrl = `https://api.twitter.com/2/users/${accountId}`;
  try {
    const userRes = await axios.get(userUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      params: { 'user.fields': 'username' },
    });
    const twitterUser = userRes?.data?.data;
    if (!twitterUser?.username) {
      throw new Error('Could not fetch valid Twitter user data.');
    }
    cachedUsername = twitterUser.username;
    lastUserFetchTime = now;
    return cachedUsername;
  } catch (error) {
    logger.error('Error fetching Twitter username:', error.message);
    throw new Error('Failed to fetch Twitter username.');
  }
}

async function fetchLatestTweet(accountId, bearerToken) {
  const tweetsUrl = `https://api.twitter.com/2/users/${accountId}/tweets`;
  try {
    const tweetsRes = await axios.get(tweetsUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      params: {
        max_results: 5,
        'tweet.fields': 'created_at,text',
        expansions: 'attachments.media_keys',
        'media.fields': 'url,type',
      },
    });
    const tweets = tweetsRes?.data?.data;
    if (!tweets?.length) return null;

    const tweet = tweets[0];
    // Check for media
    let tweetImageUrl = null;
    if (tweetsRes.data.includes?.media?.length) {
      tweetImageUrl = tweetsRes.data.includes.media[0].url;
    }
    tweet.imageUrl = tweetImageUrl;
    return tweet;
  } catch (error) {
    logger.error('Error fetching tweets:', error.message);
    throw new Error('Failed to fetch tweets from Twitter.');
  }
}

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

    const { TWITTER_ACCOUNT_ID, TWITTER_BEARER_TOKEN, TWITTER_POST_CHANNEL_ID } = process.env;
    try {
      const username = await fetchTwitterUsername(TWITTER_ACCOUNT_ID, TWITTER_BEARER_TOKEN);
      const latestTweet = await fetchLatestTweet(TWITTER_ACCOUNT_ID, TWITTER_BEARER_TOKEN);
      if (!latestTweet?.id) {
        return interaction.editReply('No recent Tweets found.');
      }
      const existingTweet = await Tweet.findOne({ tweetId: latestTweet.id });
      if (existingTweet) {
        return interaction.editReply('No new Tweet to post.');
      }

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
      logger.error('Error in x-tweet command:', error);
      return interaction.editReply('Error fetching or posting Tweet.');
    }
  },
};