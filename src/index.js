//src/index.js
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const connectDB = require('./config/db');
const cron = require('node-cron');
const winston = require('winston');

// Create logger
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

// Global error handling
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Verify all critical environment variables here once (example):
const requiredVars = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'MONGO_URI',
  // Add any others you consider mandatory
];
for (const v of requiredVars) {
  if (!process.env[v]) {
    logger.error(`Missing required env var: ${v}. Exiting.`);
    process.exit(1);
  }
}

// Simple Express health-check
const app = express();
app.get('/', (req, res) => {
  res.send('Ebisu Bot is running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, (err) => {
  if (err) {
    logger.error('Express server error:', err);
  } else {
    logger.info(`Express server running on port ${PORT}`);
  }
});

// Setup Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.on('error', (error) => logger.error('Discord Client Error:', error));
client.on('warn', (warning) => logger.warn('Discord Client Warning:', warning));

// Connect to MongoDB
connectDB().catch((error) => {
  logger.error('Failed to connect to MongoDB:', error);
  process.exit(1);
});

// Register event listeners
const readyEvent = require('./events/ready');
const interactionCreateEvent = require('./events/interactionCreate');
const messageCreateEvent = require('./events/messageCreate');
const messageReactionAddEvent = require('./events/messageReactionAdd');
const voiceStateUpdateEvent = require('./events/voiceStateUpdate');
const guildMemberUpdateEvent = require('./events/guildMemberUpdate'); // optional, if you use it

client.once(readyEvent.name, (...args) => readyEvent.execute(client, ...args));
client.on(interactionCreateEvent.name, (...args) => interactionCreateEvent.execute(...args));
client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(...args));
client.on(messageReactionAddEvent.name, (...args) => messageReactionAddEvent.execute(...args));
client.on(voiceStateUpdateEvent.name, (...args) => voiceStateUpdateEvent.execute(...args));
// If using guildMemberUpdate:
client.on(guildMemberUpdateEvent.name, (...args) => guildMemberUpdateEvent.execute(...args));

// Login
client.login(process.env.DISCORD_TOKEN).then(() => {
  global.discordClient = client; // If needed in scheduler
}).catch((error) => {
  logger.error('Error logging into Discord:', error);
  process.exit(1);
});

// Load and run scheduler
require('./scheduler');

// Graceful shutdown
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    client.destroy();
    process.exit(0);
  });
});