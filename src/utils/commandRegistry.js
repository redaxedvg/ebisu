// src/utils/commandRegistry.js
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { captureException } = require('./errorMonitoring');
const { rateLimit } = require('./rateLimiter');

/**
 * Command Registry - Manages all bot commands dynamically
 */
class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.commandFiles = new Map();
    this.contextLog = logger.withContext({ module: 'CommandRegistry' });
  }
  
  /**
   * Register a single command
   * @param {string} name - Command name
   * @param {object} handler - Command handler with execute method
   */
  register(name, handler) {
    if (this.commands.has(name)) {
      this.contextLog.warn(`Command ${name} already registered. Overwriting.`);
    }
    
    this.commands.set(name, handler);
    this.contextLog.debug(`Registered command: ${name}`);
  }
  
  /**
   * Execute a command by name
   * @param {string} name - Command name
   * @param {object} interaction - Discord interaction object
   * @returns {Promise} Result of command execution
   */
  async execute(name, interaction) {
    const start = Date.now();
    const commandHandler = this.commands.get(name);
    
    if (!commandHandler) {
      this.contextLog.warn(`Command not found: ${name}`);
      return false;
    }
    
    // Apply rate limiting for non-admin users
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      const rateLimitResult = rateLimit(`cmd:${name}:${interaction.user.id}`, 5, 60000);
      if (rateLimitResult.limited) {
        return interaction.reply({
          content: `You're using this command too frequently. Please wait ${rateLimitResult.waitTime} seconds.`,
          ephemeral: true
        });
      }
    }
    
    try {
      this.contextLog.debug(`Executing command: ${name}`, {
        user: interaction.user.id,
        guild: interaction.guild?.id
      });
      
      await commandHandler.execute(interaction);
      
      // Log execution time for performance monitoring
      const executionTime = Date.now() - start;
      this.contextLog.debug(`Command ${name} executed in ${executionTime}ms`);
      
      return true;
    } catch (error) {
      captureException(error, {
        area: 'command',
        command: name,
        user: {
          id: interaction.user.id,
          username: interaction.user.username
        },
        guild: interaction.guild?.id
      });
      
      // Respond to the user
      const reply = {
        content: 'An error occurred while processing this command.',
        ephemeral: true
      };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(e => {
          this.contextLog.error('Failed to edit reply after command error', { error: e.message });
        });
      } else {
        await interaction.reply(reply).catch(e => {
          this.contextLog.error('Failed to reply after command error', { error: e.message });
        });
      }
      
      return false;
    }
  }
  
  /**
   * Load all commands from the commands directory
   */
  loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(
      file => file.endsWith('.js') && !file.endsWith('registerCommands.js')
    );
    
    this.contextLog.info(`Loading ${commandFiles.length} command files...`);
    
    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        // Clear cache to ensure we get fresh modules during reloads
        delete require.cache[require.resolve(filePath)];
        
        const command = require(filePath);
        
        // Handle traditional command structure
        if (command.name && command.execute) {
          this.register(command.name, command);
          this.commandFiles.set(command.name, filePath);
        }
        // Handle admin command objects that contain subcommands
        else {
          // For files that export multiple commands like adminGiveTake.js
          Object.entries(command).forEach(([key, handler]) => {
            if (typeof handler === 'function' || (handler && typeof handler.execute === 'function')) {
              // Convert function name (giveCoins) to command name (give-coins)
              const cmdName = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
              this.register(cmdName, typeof handler === 'function' ? { execute: handler } : handler);
              this.commandFiles.set(cmdName, filePath);
            }
          });
        }
      } catch (error) {
        this.contextLog.error(`Failed to load command file: ${file}`, { 
          error: error.message,
          stack: error.stack
        });
      }
    }
    
    this.contextLog.info(`Loaded ${this.commands.size} commands successfully`);
    return this.commands.size;
  }
  
  /**
   * Reload a specific command by name
   * @param {string} name - Command name to reload
   * @returns {boolean} True if successful
   */
  reloadCommand(name) {
    const filePath = this.commandFiles.get(name);
    if (!filePath) {
      this.contextLog.warn(`Cannot reload command ${name}: file path not found`);
      return false;
    }
    
    try {
      // Clear cache and re-require
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      
      if (command.name === name && command.execute) {
        this.register(name, command);
        return true;
      } else {
        // Handle admin command objects
        for (const [key, handler] of Object.entries(command)) {
          const cmdName = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
          if (cmdName === name) {
            this.register(name, typeof handler === 'function' ? { execute: handler } : handler);
            return true;
          }
        }
      }
      
      this.contextLog.warn(`Command ${name} not found in file after reload`);
      return false;
    } catch (error) {
      this.contextLog.error(`Failed to reload command ${name}`, { 
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }
  
  /**
   * Get all registered command names
   * @returns {Array} Array of command names
   */
  getCommandNames() {
    return Array.from(this.commands.keys());
  }
}

// Singleton instance
const commandRegistry = new CommandRegistry();

module.exports = commandRegistry;