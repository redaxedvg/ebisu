# Discord Community Bot

A modern, scalable, production-ready Discord bot for community engagement with Twitter/X integration, economy system, and marketplace.

## Features

- **Discord Integration**: Message tracking, voice minutes, reaction monitoring
- **Twitter/X Integration**: Monitor tweets, reward engagement
- **Economy System**: User coins, daily rewards, milestones
- **Marketplace**: Role purchases with coins
- **Admin Commands**: Manage economy, rewards, and configuration

## System Architecture

The bot is built with a modular architecture focused on scalability and maintainability:

- **Command Registry**: Dynamic command loading and handling
- **Database Management**: MongoDB with migration system
- **Caching Layer**: Efficient data retrieval with TTL-based caching
- **Logging System**: Structured Winston logging with Sentry integration
- **Error Monitoring**: Comprehensive error tracking and reporting
- **Health Checks**: Container health monitoring
- **API Client**: Resilient external API communication

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 5+
- Discord Bot Token
- Twitter/X API Credentials

### Environment Variables

Create a `.env` file with the following variables:

```
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
GUILD_ID=your_discord_guild_id

# MongoDB
MONGO_URI=mongodb://localhost:27017/discordbot

# Twitter Integration
TWITTER_ACCOUNT_ID=your_twitter_account_id
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
TWITTER_CONSUMER_KEY=your_twitter_consumer_key
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret
TWITTER_ACCESS_TOKEN=your_twitter_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret
TWITTER_POST_CHANNEL_ID=your_discord_channel_id

# Optional Configuration
TEAM_ROLE_IDS=role_id_1,role_id_2
MARKETPLACE_ANNOUNCE_CHANNEL=your_marketplace_channel_id
LOG_LEVEL=info
RADIO_CHANNEL_ID=your_voice_channel_id
SENTRY_DSN=your_sentry_dsn
```

### Installation

#### Local Development

```bash
# Install dependencies
npm install

# Start the bot in development mode
npm run dev
```

#### Docker Deployment

```bash
# Build and start with Docker Compose
npm run docker:dev

# View logs
npm run docker:logs

# Stop containers
npm run docker:stop
```

## Commands

The bot provides the following commands:

### User Commands

| Command | Description |
|---------|-------------|
| `/gm` | Claim daily coins |
| `/link-x` | Link Twitter/X account |
| `/leaderboard` | View top coin holders |
| `/stats` | View personal or user stats |
| `/marketplace` | Browse purchasable roles |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/x-tweet` | Post latest tweet for engagement |
| `/x-interaction` | Manually check tweet interactions |
| `/add-marketplace` | Add item to marketplace |
| `/remove-marketplace` | Remove item from marketplace |
| `/edit-marketplace` | Edit marketplace item |
| `/give-coins` | Award coins to user |
| `/take-coins` | Remove coins from user |
| `/reset-leaderboard` | Reset all coin balances |
| `/reset-stats` | Reset all user statistics |
| `/rewardrole` | Set coin reward for role |

## Database Schema

### User
- `discordId`: String (unique)
- `username`: String
- `coins`: Number
- `messagesCount`: Number
- `reactionsCount`: Number
- `voiceMinutes`: Number
- `twitterId`: String
- `twitterUsername`: String
- `totalLikes`: Number
- `totalRetweets`: Number
- `lastDaily`: Date
- `rewardedRoles`: [String]

### Tweet
- `tweetId`: String (unique)
- `postedAt`: Date
- `likedUserIds`: [String]
- `retweetedUserIds`: [String]
- `rewardedForLikes`: [String]
- `rewardedForRetweets`: [String]
- `finalChecked`: Boolean
- `discordMessageId`: String

### MarketplaceItem
- `name`: String
- `roleId`: String
- `price`: Number

### RewardRole
- `roleId`: String (unique)
- `reward`: Number

## Development

### Testing

```bash
# Run tests
npm test

# Run linter
npm run lint
```

### Database Migrations

```bash
# Create a new migration
npm run create-migration "description of change"

# Run pending migrations
npm run migrate
```

## Deployment

### Production Deployment with Docker

```bash
# Build production image
docker build -t discord-bot:latest .

# Run with Docker
docker run -d --name discord-bot --env-file .env discord-bot:latest
```

### Kubernetes Deployment

Kubernetes deployment files are available in the `k8s/` directory.

## Architecture Decisions

- **Command Registry Pattern**: Centralized command registration and execution
- **Dependency Injection**: Services and utilities are injected where needed
- **Database Migration System**: Structured schema evolution
- **Caching Strategy**: Tiered caching for optimal performance
- **Error Handling**: Consistent error capture and reporting
- **Modular Design**: Components with clear responsibilities

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.