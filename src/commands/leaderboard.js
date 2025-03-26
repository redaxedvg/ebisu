// src/commands/leaderboard.js
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const winston = require('winston');
const { hasTeamRole } = require('../utils/roleCheck'); // Import your helper

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'leaderboard',
  description: 'View the top 10 users with the most coins (excluding Team).',
  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Fetch top ~20 to allow filtering out Team
      const topUsers = await User.find({}, null, { lean: true })
        .sort({ coins: -1 })
        .limit(20); // we fetch 20 so we can skip Team members

      if (!topUsers.length) {
        return interaction.editReply('No leaderboard data available.');
      }

      // Attempt to fetch each user as a GuildMember
      const fetchedMembers = await Promise.all(
        topUsers.map((userDoc) =>
          interaction.guild.members.fetch(userDoc.discordId).catch(() => null)
        )
      );

      // We'll build a final array of non-Team users, up to 10
      const filtered = [];
      for (let i = 0; i < topUsers.length; i++) {
        const userDoc = topUsers[i];
        const member = fetchedMembers[i];

        // If we fail to fetch the member or they have a Team role, skip them
        if (!member || hasTeamRole(member)) {
          continue;
        }

        filtered.push({ userDoc, member });
        if (filtered.length >= 10) break; // we only want top 10
      }

      if (!filtered.length) {
        return interaction.editReply('No leaderboard data available (all top are Team?).');
      }

      // rankEmojis for the top 3
      const rankEmojis = ['🏆', '🥈', '🥉'];

      // Build the leaderboard lines
      const leaderboardLines = filtered.map(({ userDoc, member }, index) => {
        const rank = rankEmojis[index] || `#${index + 1}`;
        return `${rank} **${member.user.username}** (<@${userDoc.discordId}>) - **${userDoc.coins.toLocaleString()}** coins`;
      });

      // Construct the embed
      const embed = new EmbedBuilder()
        .setTitle('🏅 Leaderboard')
        .setDescription(leaderboardLines.join('\n'))
        .setColor('Gold')
        .setThumbnail('https://static.thenounproject.com/png/5340118-200.png')
        .setFooter({ text: `Last updated: ${new Date().toLocaleString()}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in leaderboard command:', error);
      interaction.editReply('An error occurred while fetching the leaderboard.');
    }
  },
};