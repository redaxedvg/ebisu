// src/events/guildMemberUpdate.js
const { Events } = require('discord.js');
const User = require('../models/User');
const RewardRole = require('../models/RewardRole');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    try {
      const oldRoles = new Set(oldMember.roles.cache.keys());
      const newRoles = new Set(newMember.roles.cache.keys());

      const addedRoles = [...newRoles].filter((r) => !oldRoles.has(r));
      if (!addedRoles.length) return;

      let userDoc = await User.findOneAndUpdate(
        { discordId: newMember.id },
        { $setOnInsert: { username: newMember.user.username } },
        { new: true, upsert: true }
      );

      const allRewardRoles = await RewardRole.find({});
      const rewardMap = {};
      for (const rr of allRewardRoles) {
        rewardMap[rr.roleId] = rr.reward;
      }

      let totalRewardGiven = 0;
      userDoc.rewardedRoles = userDoc.rewardedRoles || [];

      for (const roleId of addedRoles) {
        if (!rewardMap[roleId]) continue; // not a reward role
        if (userDoc.rewardedRoles.includes(roleId)) continue; // already rewarded

        const amount = rewardMap[roleId];
        userDoc.coins += amount;
        totalRewardGiven += amount;
        userDoc.rewardedRoles.push(roleId);
      }

      if (totalRewardGiven > 0) {
        await userDoc.save();
        logger.info(`User ${newMember.id} gained new role(s). Awarded ${totalRewardGiven} coin(s).`);
      }
    } catch (err) {
      logger.error('Error in guildMemberUpdate (role rewards):', err);
    }
  },
};