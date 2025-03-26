// src/index.js
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { connectDB } = require('./config/db');
const config = require('./config');
const logger = require('./utils/logger');
const { initErrorMonitoring, captureException } = require('./utils/errorMonitoring');
const migrations = require('./db/migrations');
const commandRegistry = require('./utils/commandRegistry');

// Initialize error monitoring (Sentry)
initErrorMonitoring();

// Create a PID file
fs.writeFileSync(path.join(__dirname, '../.pid'), process.pid.toString());

/**
 * Bot Application Class
 * Main application wrapper for Discord bot
 */
class BotApplication {
  constructor() {
    this.express = null;
    this.server = null;
    this.client = null;
    this.contextLog = logger.withContext({ module: 'BotApplication' });
    
    // Setup global error handlers
    this.setupErrorHandlers();
  }
  
  /**
   * Setup global error handlers
   */
  setupErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      this.contextLog.error('Unhandled Promise Rejection', {
        reason: reason.stack || reason.message || reason,
        promise
      });
      captureException(reason);
    });
    
    process.on('uncaughtException', (error) => {
      this.contextLog.error('Uncaught Exception', {
        error: error.stack || error.message
      });
      captureException(error);
      
      // Exit with error code after a brief timeout to allow logging
      setTimeout(() => process.exit(1), 500);
    });
    
    // Handle graceful shutdown
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => {
        this.shutdown(signal);
      });
    });
  }
  
  /**
   * Initialize the Express HTTP server
   */
  initExpress() {
    this.express = express();
    
    // Basic request logging middleware
    this.express.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Only log significant responses
        if (duration > 500 || res.statusCode >= 400) {
          this.contextLog.info(`HTTP ${req.method} ${req.url}`, {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration,
            ip: req.ip
          });
        }
      });
      
      next();
    });
    
    // Health check endpoint
    this.express.get('/health', (req, res) => {
      const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        discordConnected: this.client?.isReady() || false
      };
      
      res.json(status);
    });
    
    // Main route
    this.express.get('/', (req, res) => {
      res.send('Ebisu Bot is running!');
    });
    
    // Create HTTP server
    this.server = http.createServer(this.express);
    
    // Start listening
    const port = config.server.port;
    this.server.listen(port, () => {
      this.contextLog.info(`HTTP server running on port ${port}`);
    });
  }
  
  /**
   * Initialize the Discord client
   */
  initDiscord() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.Reaction],
      // More efficient options
      sweepers: {
        messages: {
          interval: 60, // 1 minute
          lifetime: 3600 // 1 hour
        }
      }
    });
    
    // Discord client error handling
    this.client.on('error', (error) => {
      this.contextLog.error('Discord Client Error', { error: error.message });
      captureException(error, { area: 'discord-client' });
    });
    
    this.client.on('warn', (message) => {
      this.contextLog.warn('Discord Client Warning', { message });
    });
    
    this.client.on('debug', (message) => {
      if (config.server.environment === 'development') {
        this.contextLog.debug('Discord Debug', { message });
      }
    });
    
    // Make client globally available (for checkFinalInteractions.js)
    global.discordClient = this.client;
  }
  
  /**
   * Register event handlers
   */
  async registerEvents() {
    this.contextLog.info('Registering Discord event handlers');
    
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    // Load each event module and register it
    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
          this.client.once(event.name, (...args) => event.execute(...args));
        } else {
          this.client.on(event.name, (...args) => event.execute(...args));
        }
        
        this.contextLog.debug(`Registered event: ${event.name}`);
      } catch (error) {
        this.contextLog.error(`Error loading event file: ${file}`, {
          error: error.message
        });
        captureException(error, { area: 'event-registration' });
      }
    }
  }
  
  /**
   * Load all command modules
   */
  loadCommands() {
    this.contextLog.info('Loading command modules');
    
    try {
      const commandCount = commandRegistry.loadCommands();
      this.contextLog.info(`Loaded ${commandCount} commands successfully`);
    } catch (error) {
      this.contextLog.error('Error loading commands', {
        error: error.message,
        stack: error.stack
      });
      captureException(error, { area: 'command-loading' });
    }
  }
  
  /**
   * Initialize the scheduler
   */
  initScheduler() {
    this.contextLog.info('Initializing scheduler');
    
    try {
      require('./scheduler');
      this.contextLog.info('Scheduler initialized successfully');
    } catch (error) {
      this.contextLog.error('Error initializing scheduler', {
        error: error.message,
        stack: error.stack
      });
      captureException(error, { area: 'scheduler-init' });
    }
  }
  
  /**
   * Run database migrations
   */
  async runMigrations() {
    this.contextLog.info('Running database migrations');
    
    try {
      const result = await migrations.runMigrations();
      this.contextLog.info('Migrations complete', result);
    } catch (error) {
      this.contextLog.error('Error running migrations', {
        error: error.message,
        stack: error.stack
      });
      captureException(error, { area: 'migrations' });
      
      // Don't exit - migrations might not be essential to operation
    }
  }
  
  /**
   * Start the bot application
   */
  async start() {
    this.contextLog.info('Starting bot application');
    
    try {
      // Connect to MongoDB
      await connectDB();
      
      // Run migrations
      await this.runMigrations();
      
      // Initialize Express
      this.initExpress();
      
      // Initialize Discord client
      this.initDiscord();
      
      // Register events
      await this.registerEvents();
      
      // Load commands
      this.loadCommands();
      
      // Initialize scheduler
      this.initScheduler();
      
      // Login to Discord
      await this.client.login(config.discord.token);
      
      this.contextLog.info('Bot application started successfully');
    } catch (error) {
      this.contextLog.error('Failed to start bot application', {
        error: error.message,
        stack: error.stack
      });
      captureException(error, { area: 'application-start' });
      
      // Exit with error code
      process.exit(1);
    }
  }
  
  /**
   * Gracefully shut down the application
   */
  async shutdown(signal) {
    this.contextLog.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      // Close HTTP server first
      if (this.server) {
        await new Promise(resolve => {
          this.server.close(resolve);
        });
        this.contextLog.info('HTTP server closed');
      }
      
      // Destroy Discord client
      if (this.client) {
        this.client.destroy();
        this.contextLog.info('Discord client destroyed');
      }
      
      // Remove PID file
      try {
        fs.unlinkSync(path.join(__dirname, '../.pid'));
      } catch (err) {
        // Ignore errors removing PID file
      }
      
      this.contextLog.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      this.contextLog.error('Error during shutdown', {
        error: error.message,
        signal
      });
      process.exit(1);
    }
  }
}

// Create and start the application
const app = new BotApplication();
app.start();