// src/utils/roleCheck.js
const TEAM_ROLE_IDS = process.env.TEAM_ROLE_IDS
  ? process.env.TEAM_ROLE_IDS.split(',').map((id) => id.trim())
  : [];

/**
 * hasTeamRole(member)
 * Returns true if the member has at least one role in TEAM_ROLE_IDS.
 */
function hasTeamRole(member) {
  if (!member || !member.roles) return false;
  return TEAM_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId));
}

module.exports = { hasTeamRole };