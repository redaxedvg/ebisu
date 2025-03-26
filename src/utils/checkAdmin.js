// src/utils/checkAdmin.js
const { PermissionsBitField } = require('discord.js');

/**
 * Checks if the interaction member has Administrator permissions.
 * If not, replies (ephemerally) and returns false.
 * If yes, returns true.
 */
async function checkAdmin(interaction) {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: 'No permission.', ephemeral: true });
    return false;
  }
  return true;
}

module.exports = checkAdmin;