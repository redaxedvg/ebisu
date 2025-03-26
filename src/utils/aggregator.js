// src/utils/aggregator.js
/**
 * userStatsAccumulator is a Map:
 *   discordId -> { messagesCount, reactionsCount, voiceMinutes, ... }
 */
const userStatsAccumulator = new Map();

/**
 * accumulateUserStat
 * Increment a specified field for a given user in memory.
 */
function accumulateUserStat(discordId, field, increment = 1) {
  if (!userStatsAccumulator.has(discordId)) {
    userStatsAccumulator.set(discordId, {
      messagesCount: 0,
      reactionsCount: 0,
      voiceMinutes: 0,
      // add other fields if needed
    });
  }
  userStatsAccumulator.get(discordId)[field] += increment;
}

module.exports = {
  userStatsAccumulator,
  accumulateUserStat,
};