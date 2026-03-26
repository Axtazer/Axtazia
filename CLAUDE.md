# Axtazia Discord Bot - Claude Context

## Project Overview
**Axtazia** is a Discord bot built with discord.js v14. It's both a functional Discord bot for Axtazer's server and a personal code training project.

- **Repository**: https://github.com/Axtazer/Axtazia
- **Author**: Axtazer
- **License**: MIT
- **Main Entry Point**: `index.js`

## Tech Stack
- **Runtime**: Node.js (CommonJS)
- **Framework**: discord.js v14.25.1
- **Config Management**: dotenv v17.3.1
- **Type**: CommonJS modules

## Project Structure

```
.
├── commands/                    # Slash commands
│   ├── interactions/           # Interactive commands (hug, kiss, nasaPicture)
│   └── utility/                # Utility commands (ping, botInformations, list, wol)
├── events/                     # Discord event handlers
│   ├── interactionCreate.js    # Handles slash command interactions
│   └── ready.js                # Bot ready event
├── index.js                    # Main bot initialization
├── deploy-commands.js          # Script to register slash commands with Discord
├── package.json                # Dependencies
├── Dockerfile                  # Docker deployment config
├── .env.exemple                # Environment variables template
└── README.md                   # Project documentation
```

## Key Design Patterns

### Command Structure
Each command file exports:
```js
{
  data: SlashCommandBuilder(),  // Command metadata & options
  execute(interaction)           // Command handler
}
```

Commands are organized in subfolders (interactions, utility) and dynamically loaded in `index.js`.

### Event Handlers
Event files export:
```js
{
  name: Events.EventName,        // Discord.js event name
  once: boolean,                 // Execute once or on every event
  execute(...args)               // Event handler
}
```

All event handlers are dynamically loaded from `events/` directory.

### Bot Configuration
Uses `dotenv` to load environment variables from `.env` file:
- `DISCORD_TOKEN`: Bot authentication token
- `CLIENT_ID`: Bot application ID
- `GUILD_ID`: Target guild/server ID
- `OWNER_ID`: Owner user ID
- `NASA_APOD_KEY`: NASA Astronomy Picture of the Day API key
- `WOL_API_URL` & `WOL_API_TOKEN`: Wake-on-LAN endpoint config

## Current Commands

### Interactions
- **hug** - Interactive hug command
- **kiss** - Interactive kiss command
- **nasaPicture** - Fetch NASA's Astronomy Picture of the Day

### Utility
- **ping** - Show bot latency (WebSocket ping)
- **botInformations** - Display bot info
- **list** - List available commands
- **wol** - Wake-on-LAN functionality

## Important Implementation Details

1. **Message Caching**: Configured with zero message caching to reduce memory usage
2. **Intent**: Uses minimal intents (`GatewayIntentBits.Guilds` only)
3. **Error Handling**: Global unhandled rejection handler in index.js; per-command error handling in interactionCreate.js
4. **Slash Commands**: Only slash commands supported (no prefix commands)
5. **Ephemeral Replies**: Most command responses are ephemeral (only visible to command user)

## Deployment
- Docker support via `Dockerfile`
- Kubernetes deployment config in `deployement.yalm`
- GitHub Actions available in `.github/`

## Development Guidelines

### Adding a New Command
1. Create a `.js` file in `commands/{category}/`
2. Export object with `data` (SlashCommandBuilder) and `execute` function
3. Run `npm run deploy-commands` to register with Discord
4. Commands are auto-loaded by index.js on startup

### Adding a New Event Handler
1. Create a `.js` file in `events/`
2. Export object with `name`, `once` (boolean), and `execute` function
3. Automatically loaded by index.js on startup

### Testing Locally
1. Create `.env` file from `.env.exemple`
2. Fill in required credentials
3. Run `node index.js`

## Language Note
Codebase mixes French and English comments/variable names. French is used for some comments and command descriptions.

## Notes for Claude
- This is an active learning project, so code may have room for improvement
- Focus on maintainability and clarity when making changes
- Preserve the dynamic loading pattern for commands/events
- Keep error handling consistent with existing approach
- Always test command registration via deploy-commands.js after adding new commands
