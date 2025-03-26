// src/commands/stats.js
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const User = require('../models/User');
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

const { hasTeamRole } = require('../utils/roleCheck'); // Import your team-check helper

// Register fonts
registerFont(path.join(__dirname, '../assets/SF-Pro-Text-Light.otf'), { family: 'SFPRO-Light' });
registerFont(path.join(__dirname, '../assets/SFPRO-SEMIBOLD.otf'), { family: 'SFPRO-SEMIBOLD' });

// We'll cache the background
let cachedBackgroundImage = null;
async function getBackgroundImage() {
  if (!cachedBackgroundImage) {
    try {
      const { loadImage } = require('canvas');
      cachedBackgroundImage = await loadImage(path.join(__dirname, '../assets/stats_background.png'));
    } catch (err) {
      logger.error('Error loading background image:', err);
      throw err;
    }
  }
  return cachedBackgroundImage;
}

// Rounded rect
function drawRoundedRect(ctx, x, y, width, height, radius, fillColor) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

// Draw stat card
function drawStatCard(ctx, x, y, width, height, stat, offsets = {}) {
  const { countX = 0, countY = 0, rankX = 0, rankY = 0 } = offsets;
  drawRoundedRect(ctx, x, y, width, height, 21, 'rgba(255,255,255,0)');

  ctx.fillStyle = '#1D1D1F';
  ctx.textBaseline = 'top';
  const padding = 10;
  ctx.font = '16px "SFPRO-SEMIBOLD"';

  // Left: numeric value
  ctx.textAlign = 'left';
  ctx.fillText(stat.value.toLocaleString(), x + padding + countX, y + padding + 20 + countY);

  // Right: rank
  ctx.textAlign = 'right';
  // If rank is a number, prefix with "#". If it's a string (e.g. "TEAM"), just show it
  const rankText = typeof stat.rank === 'number' ? `#${stat.rank}` : stat.rank;
  ctx.fillText(rankText, x + width - 10 + rankX, y + padding + 20 + rankY);
}

// Draw avatar
function drawRoundedAvatar(ctx, image, x, y, size, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + size - radius, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
  ctx.lineTo(x + size, y + size - radius);
  ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
  ctx.lineTo(x + radius, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
}

// Format date
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}.${day}.${year}`;
}

/**
 * Helper to compute a rank for a stat, excluding team users from the "greater" set.
 * @param {object} interaction - The Discord interaction (used to fetch guild members).
 * @param {string} field - The field name, e.g. "messagesCount"
 * @param {number} value - The user's current value for that stat
 * @returns {number} The rank among non-team
 */
async function computeRankExcludingTeam(interaction, field, value) {
  // 1) find all users with a strictly greater value
  const docs = await User.find({ [field]: { $gt: value } }, 'discordId', { lean: true });

  let validCount = 0;
  for (const doc of docs) {
    // fetch the guild member
    const member = await interaction.guild.members.fetch(doc.discordId).catch(() => null);
    if (!member) continue;
    // skip them if they are team
    if (hasTeamRole(member)) continue;
    // otherwise, increment
    validCount++;
  }
  // rank is validCount + 1
  return validCount + 1;
}

module.exports = {
  name: 'stats',
  description: 'Show your or another user’s stats as an image, ignoring Team from rank.',
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      // retrieve user doc
      const userDoc = await User.findOne({ discordId: targetUser.id });
      if (!userDoc) {
        return interaction.editReply(`${targetUser.username} has no stats yet.`);
      }

      // check if they are Team
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      let isTeam = false;
      if (member && hasTeamRole(member)) {
        isTeam = true;
      }

      // If user is Team, we override rank to "TEAM"
      let msgRank, reactRank, voiceRank, likeRank, rtRank, coinRank;
      if (isTeam) {
        msgRank = 'TEAM';
        reactRank = 'TEAM';
        voiceRank = 'TEAM';
        likeRank = 'TEAM';
        rtRank = 'TEAM';
        coinRank = 'TEAM';
      } else {
        // user is not Team, compute each rank skipping Team from the "greater" set
        const [
          mRank,
          rRank,
          vRank,
          lRank,
          rtRankVal,
          cRank
        ] = await Promise.all([
          computeRankExcludingTeam(interaction, 'messagesCount', userDoc.messagesCount),
          computeRankExcludingTeam(interaction, 'reactionsCount', userDoc.reactionsCount),
          computeRankExcludingTeam(interaction, 'voiceMinutes', userDoc.voiceMinutes),
          computeRankExcludingTeam(interaction, 'totalLikes', userDoc.totalLikes),
          computeRankExcludingTeam(interaction, 'totalRetweets', userDoc.totalRetweets),
          computeRankExcludingTeam(interaction, 'coins', userDoc.coins),
        ]);
        msgRank = mRank;
        reactRank = rRank;
        voiceRank = vRank;
        likeRank = lRank;
        rtRank = rtRankVal;
        coinRank = cRank;
      }

      // Build stat arrays
      const discordStats = [
        { value: userDoc.messagesCount, rank: msgRank },
        { value: userDoc.voiceMinutes, rank: voiceRank },
        { value: userDoc.reactionsCount, rank: reactRank },
      ];
      const socialStats = [
        { value: userDoc.totalLikes, rank: likeRank },
        { value: userDoc.totalRetweets, rank: rtRank },
        { value: userDoc.coins, rank: coinRank },
      ];
      const statCards = discordStats.concat(socialStats);

      // createCanvas
      const { createCanvas } = require('canvas');
      const canvasWidth = 941;
      const canvasHeight = 321;
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // background
      try {
        const bg = await getBackgroundImage();
        ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);
      } catch {
        ctx.fillStyle = '#F5F5F7';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // draw avatar
      const avatarSize = 50;
      const avatarX = 24;
      const avatarY = 24;
      try {
        const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
        const img = await loadImage(avatarURL);
        drawRoundedAvatar(ctx, img, avatarX, avatarY, avatarSize, 5);
      } catch (err) {
        logger.error('Error loading avatar image:', err);
      }

     // user info
     const infoX = avatarX + avatarSize + 13;
     const infoY = 24;
     ctx.fillStyle = '#1D1D1F';
     ctx.textBaseline = 'top';
     
     ctx.font = '24px "SFPRO-SEMIBOLD"';
     const displayName = targetUser.displayName || targetUser.username;
     ctx.fillText(displayName, infoX, infoY);
     
     ctx.font = '16px "SFPRO-Light"';
     ctx.fillText(targetUser.username, infoX, infoY + 30);

      // layout for stat cards
      const cardWidth = 280;
      const cardHeight = 70;
      const cardGapX = 24;
      const cardGapY = 24;
      const row1Y = 100;
      const row2Y = row1Y + cardHeight + cardGapY;

      const row1Offsets = [
        { countX: 7, countY: 6, rankX: -5, rankY: 6 },
        { countX: 9, countY: 6, rankX: -2, rankY: 6 },
        { countX: 10, countY: 6, rankX: 0, rankY: 6 },
      ];
      const row2Offsets = [
        { countX: 6, countY: -6, rankX: -5, rankY: -6 },
        { countX: 8, countY: -6, rankX: -2, rankY: -6 },
        { countX: 10, countY: -6, rankX: -1, rankY: -6 },
      ];

      // draw first row
      for (let i = 0; i < 3; i++) {
        const x = 24 + i * (cardWidth + cardGapX);
        drawStatCard(ctx, x, row1Y, cardWidth, cardHeight, statCards[i], row1Offsets[i]);
      }

      // draw second row
      for (let i = 3; i < 6; i++) {
        const x = 24 + (i - 3) * (cardWidth + cardGapX);
        drawStatCard(ctx, x, row2Y, cardWidth, cardHeight, statCards[i], row2Offsets[i - 3]);
      }

      // footer join date
      const footerY = row2Y + cardHeight + cardGapY;
      ctx.font = '16px "SFPRO-SEMIBOLD"';
      ctx.fillStyle = '#1D1D1F';
      ctx.textAlign = 'left';
      const guildMember = interaction.guild.members.cache.get(targetUser.id);
      let joinDate = 'N/A';
      if (guildMember && guildMember.joinedAt) {
        joinDate = formatDate(guildMember.joinedAt);
      }
      ctx.fillText(joinDate, 157, footerY - 11);

      // finalize
      const buffer = canvas.toBuffer();
      const { AttachmentBuilder } = require('discord.js');
      const attachment = new AttachmentBuilder(buffer, { name: 'stats.png' });
      return interaction.editReply({ files: [attachment] });
    } catch (error) {
      logger.error('Error generating stats image:', error);
      return interaction.editReply('An error occurred while retrieving stats.');
    }
  },
};