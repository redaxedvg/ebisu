// src/commands/gm.js
const User = require('../models/User');
const moment = require('moment');
const logger = require('../utils/logger');
const { validatePositiveInteger } = require('../utils/validator');
const commandRegistry = require('../utils/commandRegistry');
const { captureException } = require('../utils/errorMonitoring');

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

/**
 * Daily GM Command
 */
const gmCommand = {
  name: 'gm',
  description: 'Get your daily GM reward',
  
  /**
   * Calculate reward amount based on probability
   * @returns {number} The reward amount
   */
  calculateReward() {
    // Example weighted random: 1 coin = 40% chance, 100 coins = 1 in 10,000, otherwise 2..99 weighted
    const rand = Math.random();
    if (rand < 0.0001) {
      return 100;
    } else if (rand < 0.4001) {
      return 1;
    } else {
      return pickWeighted(2, 99);
    }
  },
  
  /**
   * Execute the GM command
   * @param {Object} interaction - Discord interaction
   */
  async execute(interaction) {
    const cmdLog = logger.withContext({ 
      command: 'gm',
      userId: interaction.user.id 
    });
    
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
          cmdLog.debug('User attempted GM before cooldown', { hoursLeft: 24 - diffHours });
          
          return interaction.editReply(
            `Sorry <@${discordId}>, you have **${24 - diffHours}** hour(s) left until your next GM reward.`
          );
        }
      }

      // Calculate reward
      const reward = this.calculateReward();
      
      userDoc.coins += reward;
      userDoc.lastDaily = now.toDate();
      await userDoc.save();
      
      cmdLog.info('User claimed GM reward', { reward });

      // Use the mention and a custom message
      await interaction.editReply(`gm <@${discordId}>! You earned **${reward}** coin(s) today!`);
    } catch (error) {
      captureException(error, { command: 'gm', user: interaction.user.id });
      cmdLog.error('Error in GM command', { error: error.message });
      
      // Reply to user
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('An error occurred while claiming the daily GM.');
      } else {
        await interaction.reply({ content: 'An error occurred while claiming the daily GM.', ephemeral: true });
      }
    }
  }
};

// Register command
commandRegistry.register(gmCommand.name, gmCommand);

module.exports = gmCommand;