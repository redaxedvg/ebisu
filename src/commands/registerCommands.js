// src/commands/registerCommands.js
const { REST, Routes, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

async function registerSlashCommands() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    logger.error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID environment variables.');
    return;
  }

  const commands = [
    { name: 'gm', description: 'Get your daily GM reward' },
    {
      name: 'x-tweet',
      description: 'Check if Twitter account has a new Tweet and post it.',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
    },
    {
      name: 'x-interaction',
      description: 'Manually check for likes/retweets on a Tweet.',
      options: [
        {
          name: 'tweetid',
          description: 'The Tweet ID to check',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    // NOTE: The "radio" command has been REMOVED from this array.

    {
      name: 'link-x',
      description: 'Link your Twitter/X account.',
      options: [
        {
          name: 'username',
          description: 'Your Twitter username (without @)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    { name: 'leaderboard', description: 'View the top 10 coin holders.' },
    {
      name: 'stats',
      description: 'Show stats for you or another user.',
      options: [
        {
          name: 'user',
          description: 'User to show stats for',
          type: ApplicationCommandOptionType.User,
          required: false,
        },
      ],
    },
    {
      name: 'add-marketplace',
      description: 'Add a role to the marketplace. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
      options: [
        {
          name: 'item_name',
          description: 'Name of the item',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'role',
          description: 'Role to associate with this item',
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
        {
          name: 'price',
          description: 'Price of the item in coins',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
    {
      name: 'remove-marketplace',
      description: 'Remove an item from the marketplace. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
      options: [
        {
          name: 'item_name',
          description: 'Item name to remove',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'edit-marketplace',
      description: 'Edit a marketplace item. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
      options: [
        {
          name: 'item_name',
          description: 'Current item name',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'new_name',
          description: 'New item name',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: 'new_price',
          description: 'New item price',
          type: ApplicationCommandOptionType.Integer,
          required: false,
        },
        {
          name: 'new_role',
          description: 'New role for the item',
          type: ApplicationCommandOptionType.Role,
          required: false,
        },
      ],
    },
    {
      name: 'marketplace',
      description: 'View the marketplace.',
    },
    {
      name: 'give-coins',
      description: 'Give coins to a user. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
      options: [
        {
          name: 'user',
          description: 'User to give coins to',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'amount',
          description: 'Amount of coins to give',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
    {
      name: 'rewardrole',
      description: 'Add or update a role reward in the database. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
      options: [
        {
          name: 'role',
          description: 'Select the Discord role to reward',
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
        {
          name: 'amount',
          description: 'Amount of coins rewarded for this role',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
    {
      name: 'take-coins',
      description: 'Take coins from a user. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
      options: [
        {
          name: 'user',
          description: 'User to take coins from',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'amount',
          description: 'Amount of coins to take',
          type: ApplicationCommandOptionType.Integer,
          required: true,
        },
      ],
    },
    {
      name: 'reset-leaderboard',
      description: 'Reset the leaderboard. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
    },
    {
      name: 'reset-stats',
      description: 'Reset all user stats. (Admin only)',
      default_member_permissions: String(PermissionFlagsBits.Administrator),
    },
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error while registering slash commands:', error);
  }
}

module.exports = registerSlashCommands;