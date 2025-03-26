// src/commands/marketplace.js
const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionsBitField
} = require('discord.js');
const MarketplaceItem = require('../models/MarketplaceItem');
const User = require('../models/User');
const checkAdmin = require('../utils/checkAdmin');
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});

module.exports = {
  name: 'marketplace',
  description: 'View the marketplace embed.',
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const items = await MarketplaceItem.find();
      if (!items.length) {
        return interaction.editReply('No items in the marketplace.');
      }

      const embed = new EmbedBuilder()
        .setTitle('Marketplace')
        .setDescription('Click the button to purchase')
        .setColor('Green');

      items.forEach((it) => {
        embed.addFields({ name: it.name, value: `Price: ${it.price} coins` });
      });

      // Create rows of buttons (5 max per row)
      const rows = [];
      let row = new ActionRowBuilder();
      let count = 0;

      for (const item of items) {
        const button = new ButtonBuilder()
          .setCustomId(`purchase_${item._id}`)
          .setLabel(`Buy ${item.name}`)
          .setStyle(ButtonStyle.Primary);

        row.addComponents(button);
        count++;
        if (count === 5) {
          rows.push(row);
          row = new ActionRowBuilder();
          count = 0;
        }
      }
      if (count > 0) rows.push(row);

      return interaction.editReply({ embeds: [embed], components: rows });
    } catch (error) {
      logger.error('Error in marketplace command:', error);
      interaction.editReply('An error occurred while fetching the marketplace.');
    }
  },

  // Admin subcommands

  async addMarketplace(interaction) {
    // Reuse checkAdmin helper
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const itemName = interaction.options.getString('item_name');
      const role = interaction.options.getRole('role');
      const price = interaction.options.getInteger('price');

      if (!itemName || !role || price == null) {
        return interaction.editReply('Missing parameters. Provide item name, role, and price.');
      }

      await MarketplaceItem.create({ name: itemName, roleId: role.id, price });
      return interaction.editReply(`Item **${itemName}** added. Role: ${role.name}, Price: ${price}`);
    } catch (error) {
      logger.error('Error adding marketplace item:', error);
      interaction.editReply('An error occurred while adding the item.');
    }
  },

  async removeMarketplace(interaction) {
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const itemName = interaction.options.getString('item_name');
      if (!itemName) {
        return interaction.editReply('Please provide the item name to remove.');
      }

      const item = await MarketplaceItem.findOneAndDelete({ name: itemName });
      if (!item) {
        return interaction.editReply(`No item named "${itemName}".`);
      }
      return interaction.editReply(`Item **${itemName}** removed.`);
    } catch (error) {
      logger.error('Error removing marketplace item:', error);
      interaction.editReply('An error occurred while removing the item.');
    }
  },

  async editMarketplace(interaction) {
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const itemName = interaction.options.getString('item_name');
      const newName = interaction.options.getString('new_name');
      const newPrice = interaction.options.getInteger('new_price');
      const newRole = interaction.options.getRole('new_role');

      if (!itemName) {
        return interaction.editReply('Please provide the item name to edit.');
      }

      const item = await MarketplaceItem.findOne({ name: itemName });
      if (!item) {
        return interaction.editReply(`No item found with name "${itemName}".`);
      }

      if (newName) item.name = newName;
      if (newPrice != null) item.price = newPrice;
      if (newRole) item.roleId = newRole.id;

      await item.save();
      return interaction.editReply(`Item **${itemName}** updated successfully.`);
    } catch (error) {
      logger.error('Error editing marketplace item:', error);
      interaction.editReply('An error occurred while editing the item.');
    }
  },
};