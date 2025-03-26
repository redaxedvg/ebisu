// src/utils/milestoneCheck.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

/**
 * Checks userDoc fields against milestone thresholds and awards coins accordingly.
 * Integrates with aggregator-based increments after they are saved.
 */
async function checkMilestones(userDoc) {
  const milestones = {
    messages: [
      { threshold: 50, reward: 1 },
      { threshold: 100, reward: 2 },
      // add more if desired
    ],
    reactions: [
      { threshold: 50, reward: 1 },
    ],
    voice: [
      { threshold: 30, reward: 1 },
    ],
  };

  let coinsToAward = 0;

  // Check messages
  for (const m of milestones.messages) {
    if (userDoc.messagesCount === m.threshold) {
      coinsToAward += m.reward;
    }
  }

  // Check reactions
  for (const r of milestones.reactions) {
    if (userDoc.reactionsCount === r.threshold) {
      coinsToAward += r.reward;
    }
  }

  // Check voice
  for (const v of milestones.voice) {
    if (userDoc.voiceMinutes === v.threshold) {
      coinsToAward += v.reward;
    }
  }

  if (coinsToAward > 0) {
    userDoc.coins += coinsToAward;
    try {
      await userDoc.save();
      logger.info(`Awarded ${coinsToAward} coin(s) to user ${userDoc.discordId} for milestones.`);
    } catch (err) {
      logger.error('Error saving milestone rewards:', err);
    }
  }
}

module.exports = checkMilestones;