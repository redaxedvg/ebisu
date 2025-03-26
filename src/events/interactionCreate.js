// src/events/interactionCreate.js
const { Events } = require('discord.js');
const logger = require('../utils/logger');
const commandRegistry = require('../utils/commandRegistry');
const { captureException } = require('../utils/errorMonitoring');
const marketplaceCommands = require('../commands/marketplace');

/**
 * Interaction event handler to process all Discord interactions
 */
module.exports = {
  name: Events.InteractionCreate,
  
  /**
   * Execute interaction handler
   * @param {Object} interaction - Discord interaction
   */
  async execute(interaction) {
    const contextLog = logger.withContext({
      module: 'InteractionHandler',
      userId: interaction.user.id,
      guildId: interaction.guild?.id
    });
    
    try {
      // Handle command interactions (slash commands)
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        
        contextLog.debug(`Processing command: ${commandName}`);
        
        // Use the command registry to execute commands dynamically
        const executed = await commandRegistry.execute(commandName, interaction);
        
        if (!executed) {
          contextLog.warn(`Command not found in registry: ${commandName}`);
          await interaction.reply({ 
            content: 'That command is not currently available.',
            ephemeral: true
          });
        }
        
        return;
      } 
      // Handle button interactions
      else if (interaction.isButton()) {
        const { customId } = interaction;
        contextLog.debug(`Processing button interaction: ${customId}`);
        
        // Handle marketplace purchases
        if (customId.startsWith('purchase_')) {
          const itemId = customId.split('_')[1];
          return marketplaceCommands.processPurchase(interaction, itemId);
        }
        
        // Add handling for other button types as needed
        contextLog.warn(`Unhandled button interaction: ${customId}`);
      }
      // Handle select menu interactions
      else if (interaction.isStringSelectMenu()) {
        const { customId } = interaction;
        contextLog.debug(`Processing select menu: ${customId}`);
        
        // Add handling for select menus as needed
      }
      // Handle modal submissions
      else if (interaction.isModalSubmit()) {
        const { customId } = interaction;
        contextLog.debug(`Processing modal submission: ${customId}`);
        
        // Add handling for modals as needed
      }
      // Handle context menu interactions
      else if (interaction.isContextMenuCommand()) {
        const { commandName } = interaction;
        contextLog.debug(`Processing context menu command: ${commandName}`);
        
        // Add handling for context menu commands as needed
      }
      // Handle autocomplete interactions
      else if (interaction.isAutocomplete()) {
        const { commandName } = interaction;
        contextLog.debug(`Processing autocomplete for: ${commandName}`);
        
        // Add handling for autocomplete as needed
      }
    } catch (error) {
      captureException(error, {
        area: 'interaction-handler',
        interaction: {
          type: interaction.type,
          commandName: interaction.commandName,
          customId: interaction.customId,
        }
      });
      
      contextLog.error('Unhandled error in interaction handler', {
        error: error.message,
        stack: error.stack
      });
      
      // Attempt to respond to the user
      try {
        const reply = { 
          content: 'An error occurred while processing this interaction.',
          ephemeral: true
        };
        
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError) {
        contextLog.error('Failed to reply after interaction error', {
          error: replyError.message
        });
      }
    }
  },
};