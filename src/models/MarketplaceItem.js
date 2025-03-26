// src/models/MarketplaceItem.js
const mongoose = require('mongoose');

const marketplaceItemSchema = new mongoose.Schema({
  name: { type: String, index: true },
  roleId: String,
  price: Number,
});

module.exports = mongoose.model('MarketplaceItem', marketplaceItemSchema);