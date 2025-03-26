// src/models/RewardRole.js
const mongoose = require('mongoose');

const rewardRoleSchema = new mongoose.Schema({
  roleId: { type: String, required: true, unique: true },
  reward: { type: Number, required: true },
});

module.exports = mongoose.model('RewardRole', rewardRoleSchema);