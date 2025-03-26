// src/config/index.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
  },
  mongodb: {
    uri: process.env.MONGO_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  twitter: {
    accountId: process.env.TWITTER_ACCOUNT_ID,
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    postChannelId: process.env.TWITTER_POST_CHANNEL_ID
  },
  radio: {
    channelId: process.env.RADIO_CHANNEL_ID
  },
  marketplace: {
    announceChannelId: process.env.MARKETPLACE_ANNOUNCE_CHANNEL
  },
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  teamRoleIds: process.env.TEAM_ROLE_IDS 
    ? process.env.TEAM_ROLE_IDS.split(',').map(id => id.trim())
    : [],
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0
    }
  }
};

// Validate required configuration
const requiredConfigs = [
  'discord.token', 
  'discord.clientId', 
  'discord.guildId',
  'mongodb.uri'
];

for (const key of requiredConfigs) {
  const value = key.split('.').reduce((obj, k) => obj && obj[k], config);
  if (!value) {
    throw new Error(`Missing required configuration: ${key}`);
  }
}

module.exports = config;