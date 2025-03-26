// src/utils/voiceTracker.js
/**
 * A set of user IDs currently in voice channels.
 */
const usersInVoice = new Set();

function addUserToVoice(discordId, isBot = false) {
  if (isBot) return;
  usersInVoice.add(discordId);
}

function removeUserFromVoice(discordId) {
  usersInVoice.delete(discordId);
}

function getUsersInVoice() {
  return [...usersInVoice];
}

module.exports = {
  addUserToVoice,
  removeUserFromVoice,
  getUsersInVoice,
};