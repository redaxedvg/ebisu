// src/utils/twitterAuth.js
const axios = require('axios');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET,
} = process.env;

if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
  throw new Error('Missing Twitter API credentials.');
}

const oauth = OAuth({
  consumer: { key: TWITTER_CONSUMER_KEY, secret: TWITTER_CONSUMER_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
});

async function getTweetLikingUsers(tweetId) {
  if (!tweetId) throw new Error('tweetId is required');
  const url = `https://api.twitter.com/2/tweets/${tweetId}/liking_users`;

  const requestData = { url, method: 'GET' };
  const token = { key: TWITTER_ACCESS_TOKEN, secret: TWITTER_ACCESS_TOKEN_SECRET };
  const authHeader = oauth.authorize(requestData, token);
  const headers = {
    ...oauth.toHeader(authHeader),
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    logger.error(`Error fetching liking users for tweetId ${tweetId}:`, error.message);
    throw error;
  }
}

async function getTweetRetweetingUsers(tweetId) {
  if (!tweetId) throw new Error('tweetId is required');
  const url = `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by`;

  const requestData = { url, method: 'GET' };
  const token = { key: TWITTER_ACCESS_TOKEN, secret: TWITTER_ACCESS_TOKEN_SECRET };
  const authHeader = oauth.authorize(requestData, token);
  const headers = {
    ...oauth.toHeader(authHeader),
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    logger.error(`Error fetching retweeting users for tweetId ${tweetId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getTweetLikingUsers,
  getTweetRetweetingUsers,
};