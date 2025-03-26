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
const config = require('../config');
const logger = require('../utils/logger');
const { validateString, validatePositiveInteger } = require('../utils/validator');
const { defaultCache } = require('../utils/cacheManager');
const commandRegistry = require('../utils/commandRegistry');
const { captureException } = require('../utils/errorMonitoring');

/**
 * Marketplace Commands
 */
const marketplaceCommands = {
  /**
   * Main marketplace command to view available items
   */
  async execute(interaction) {
    const cmdLog = logger.withContext({ 
      command: 'marketplace',
      userId: interaction.user.id
    });
    
    await interaction.deferReply();
    
    try {
      // Try to get from cache first
      const cacheKey = `marketplace:${interaction.guild.id}`;
      const cachedResponse = defaultCache.get(cacheKey);
      
      if (cachedResponse) {
        cmdLog.debug('Serving cached marketplace');
        return interaction.editReply(cachedResponse);
      }
      
      // Fetch all marketplace items
      const items = await MarketplaceItem.find().lean();
      
      if (!items.length) {
        return interaction.editReply('No items are available in the marketplace.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🛒 Marketplace')
        .setDescription('Click the button below to purchase items')
        .setColor('Green');

      items.forEach((item) => {
        embed.addFields({ 
          name: item.name, 
          value: `Price: **${item.price}** coins` 
        });
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
      
      if (count > 0) {
        rows.push(row);
      }

      const responseData = { embeds: [embed], components: rows };
      
      // Cache the response
      defaultCache.set(cacheKey, responseData, 60); // 1 minute TTL
      
      return interaction.editReply(responseData);
    } catch (error) {
      captureException(error, { 
        command: 'marketplace',
        guild: interaction.guild.id
      });
      
      cmdLog.error('Error displaying marketplace', { error: error.message });
      return interaction.editReply('An error occurred while fetching the marketplace.');
    }
  },

  /**
   * Admin command to add an item to the marketplace
   */
  async addMarketplace(interaction) {
    const cmdLog = logger.withContext({ 
      command: 'add-marketplace',
      userId: interaction.user.id
    });
    
    // Reuse checkAdmin helper
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      // Validate inputs
      const itemName = validateString(interaction.options.getString('item_name'), {
        fieldName: 'Item name',
        minLength: 1,
        maxLength: 50
      });
      
      const role = interaction.options.getRole('role');
      if (!role) {
        return interaction.editReply('Please provide a valid role.');
      }
      
      const price = validatePositiveInteger(
        interaction.options.getInteger('price'),
        'Price'
      );

      // Clear marketplace cache on updates
      const cacheKey = `marketplace:${interaction.guild.id}`;
      defaultCache.del(cacheKey);
      
      // Create the item
      const newItem = await MarketplaceItem.create({ 
        name: itemName, 
        roleId: role.id, 
        price 
      });
      
      cmdLog.info('Added marketplace item', { 
        itemId: newItem._id,
        itemName,
        roleId: role.id,
        price
      });
      
      return interaction.editReply(`✅ Item **${itemName}** added. Role: ${role.name}, Price: ${price}`);
    } catch (error) {
      captureException(error, { 
        command: 'add-marketplace',
        guild: interaction.guild.id
      });
      
      cmdLog.error('Error adding marketplace item', { error: error.message });
      return interaction.editReply('An error occurred while adding the item.');
    }
  },

  /**
   * Admin command to remove an item from the marketplace
   */
  async removeMarketplace(interaction) {
    const cmdLog = logger.withContext({ 
      command: 'remove-marketplace',
      userId: interaction.user.id
    });
    
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const itemName = validateString(
        interaction.options.getString('item_name'),
        { fieldName: 'Item name' }
      );

      // Clear cache on updates
      const cacheKey = `marketplace:${interaction.guild.id}`;
      defaultCache.del(cacheKey);
      
      const item = await MarketplaceItem.findOneAndDelete({ name: itemName });
      
      if (!item) {
        return interaction.editReply(`❌ No item named "${itemName}" found.`);
      }
      
      cmdLog.info('Removed marketplace item', { 
        itemId: item._id,
        itemName
      });
      
      return interaction.editReply(`✅ Item **${itemName}** removed.`);
    } catch (error) {
      captureException(error, { 
        command: 'remove-marketplace',
        guild: interaction.guild.id
      });
      
      cmdLog.error('Error removing marketplace item', { error: error.message });
      return interaction.editReply('An error occurred while removing the item.');
    }
  },

  /**
   * Admin command to edit an existing marketplace item
   */
  async editMarketplace(interaction) {
    const cmdLog = logger.withContext({ 
      command: 'edit-marketplace',
      userId: interaction.user.id
    });
    
    if (!(await checkAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    try {
      const itemName = validateString(
        interaction.options.getString('item_name'),
        { fieldName: 'Item name' }
      );
      
      const newName = interaction.options.getString('new_name');
      if (newName) {
        validateString(newName, {
          fieldName: 'New name',
          minLength: 1,
          maxLength: 50
        });
      }
      
      const newPrice = interaction.options.getInteger('new_price');
      if (newPrice !== null) {
        validatePositiveInteger(newPrice, 'New price');
      }
      
      const newRole = interaction.options.getRole('new_role');

      // Clear cache on updates
      const cacheKey = `marketplace:${interaction.guild.id}`;
      defaultCache.del(cacheKey);
      
      const item = await MarketplaceItem.findOne({ name: itemName });
      
      if (!item) {
        return interaction.editReply(`❌ No item found with name "${itemName}".`);
      }

      // Record changes for logging
      const changes = {};
      
      if (newName) {
        changes.name = { from: item.name, to: newName };
        item.name = newName;
      }
      
      if (newPrice !== null) {
        changes.price = { from: item.price, to: newPrice };
        item.price = newPrice;
      }
      
      if (newRole) {
        changes.roleId = { from: item.roleId, to: newRole.id };
        item.roleId = newRole.id;
      }

      await item.save();
      
      cmdLog.info('Updated marketplace item', { 
        itemId: item._id,
        changes 
      });
      
      return interaction.editReply(`✅ Item **${itemName}** updated successfully.`);
    } catch (error) {
      captureException(error, { 
        command: 'edit-marketplace',
        guild: interaction.guild.id
      });
      
      cmdLog.error('Error editing marketplace item', { error: error.message });
      return interaction.editReply('An error occurred while editing the item.');
    }
  },
  
  /**
   * Process a marketplace purchase
   * @param {Object} interaction - Button interaction
   * @param {string} itemId - ID of the item to purchase
   */
  async processPurchase(interaction, itemId) {
    const cmdLog = logger.withContext({ 
      area: 'marketplace-purchase',
      userId: interaction.user.id
    });
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const item = await MarketplaceItem.findById(itemId);
      
      if (!item) {
        return interaction.editReply('❌ This item no longer exists.');
      }

      // Find or create user
      let userDoc = await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        { $setOnInsert: { username: interaction.user.username } },
        { new: true, upsert: true }
      );

      // Check if user has enough coins
      if (userDoc.coins < item.price) {
        const diff = item.price - userDoc.coins;
        return interaction.editReply(
          `❌ You need **${diff}** more coins to buy **${item.name}**.`
        );
      }

      // Deduct coins - use findOneAndUpdate to make this atomic
      userDoc = await User.findOneAndUpdate(
        { discordId: interaction.user.id },
        { $inc: { coins: -item.price } },
        { new: true }
      );

      // Fetch role and add to user
      const role = interaction.guild.roles.cache.get(item.roleId);
      
      if (!role) {
        // Refund coins if role doesn't exist
        await User.updateOne(
          { discordId: interaction.user.id },
          { $inc: { coins: item.price } }
        );
        
        return interaction.editReply(
          `❌ The role for **${item.name}** no longer exists. Your coins have been refunded.`
        );
      }

      // Add role to member
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(role);

      cmdLog.info('User purchased marketplace item', { 
        itemId: item._id,
        itemName: item.name,
        roleId: role.id,
        price: item.price
      });
      
      // Confirm purchase to user
      await interaction.editReply(
        `✅ You purchased **${item.name}** and received the **${role.name}** role!`
      );

      // Announce purchase if configured
      const announceChannelId = config.marketplace.announceChannelId;
      
      if (announceChannelId) {
        try {
          const announceChannel = await interaction.client.channels.fetch(announceChannelId);
          
          if (announceChannel?.isTextBased()) {
            await announceChannel.send(
              `🎉 Congratulations, **<@${interaction.user.id}>** purchased **${item.name}**!`
            );
          }
        } catch (err) {
          cmdLog.error('Failed to send marketplace announcement', { 
            error: err.message 
          });
        }
      }
    } catch (error) {
      captureException(error, { 
        area: 'marketplace-purchase',
        guild: interaction.guild.id,
        itemId
      });
      
      cmdLog.error('Error processing marketplace purchase', { 
        error: error.message 
      });
      
      return interaction.editReply('❌ An error occurred while processing your purchase.');
    }
  }
};

// Register commands
commandRegistry.register('marketplace', marketplaceCommands);
commandRegistry.register('add-marketplace', marketplaceCommands);
commandRegistry.register('remove-marketplace', marketplaceCommands);
commandRegistry.register('edit-marketplace', marketplaceCommands);

module.exports = marketplaceCommands;