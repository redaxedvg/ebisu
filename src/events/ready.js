// src/events/ready.js
const { Events } = require('discord.js');
const registerSlashCommands = require('../commands/registerCommands');
const winston = require('winston');
const { addUserToVoice } = require('../utils/voiceTracker');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);

    // Register slash commands on startup
    await registerSlashCommands();
    logger.info('Slash commands registered.');

    // Identify any users already in voice
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const members = await guild.members.fetch();
        let count = 0;
        for (const [memberId, member] of members) {
          if (member.voice.channel && !member.user.bot) {
            addUserToVoice(memberId);
            count++;
          }
        }
        if (count > 0) {
          logger.info(
            `In guild "${guild.name}" (${guildId}), added ${count} user(s) to voice tracker on startup.`
          );
        }
      } catch (err) {
        logger.error(`Error fetching members in guild ${guildId}:`, err);
      }
    }

    logger.info('Bot is ready. Voice states have been initialized.');
  },
};