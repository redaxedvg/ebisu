// src/commands/gm.js
const User = require('../models/User');
const moment = require('moment');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'gm',
  description: 'Get your daily GM reward',
  async execute(interaction) {
    try {
      const { id: discordId, username } = interaction.user;
      // Remove the "ephemeral: true" so the response is public
      await interaction.deferReply(); 

      let userDoc = await User.findOneAndUpdate(
        { discordId },
        { $setOnInsert: { username, coins: 0 } },
        { new: true, upsert: true }
      );

      // Daily cooldown check
      const now = moment();
      if (userDoc.lastDaily) {
        const diffHours = now.diff(moment(userDoc.lastDaily), 'hours');
        if (diffHours < 24) {
          return interaction.editReply(
            `Sorry <@${discordId}>, you have **${24 - diffHours}** hour(s) left until your next GM reward.`
          );
        }
      }

      // Example weighted random: 1 coin = 40% chance, 100 coins = 1 in 10,000, otherwise 2..99 weighted
      let reward;
      const rand = Math.random();
      if (rand < 0.0001) {
        reward = 100;
      } else if (rand < 0.4001) {
        reward = 1;
      } else {
        reward = pickWeighted(2, 99);
      }

      userDoc.coins += reward;
      userDoc.lastDaily = now.toDate();
      await userDoc.save();

      // Use the mention and a custom message
      await interaction.editReply(`gm <@${discordId}>! You earned **${reward}** coin(s) today!`);
    } catch (error) {
      logger.error('Error in GM command:', error);
      interaction.editReply('An error occurred while claiming the daily GM.');
    }
  },
};

/**
 * pickWeighted(min, max)
 * Returns a random integer in [min..max], using 1/(k^2) weighting:
 * smaller k is more likely, larger k is rarer.
 */
function pickWeighted(min, max) {
  const weights = [];
  let sum = 0;

  for (let k = min; k <= max; k++) {
    const w = 1 / (k * k);
    weights.push(w);
    sum += w;
  }

  const r = Math.random() * sum;
  let cumulative = 0;

  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) {
      return min + i;
    }
  }
  // Fallback
  return max;
}