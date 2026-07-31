# Axtazia

Bot Discord pour le serveur d'Axtazer — et projet d'apprentissage personnel.

[![Docker Build](https://github.com/Axtazer/Axtazia/actions/workflows/build.yml/badge.svg)](https://github.com/Axtazer/Axtazia/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Commandes

### Utilitaires
| Commande | Description |
|---|---|
| `/bot` | Informations sur le bot (uptime, ping, etc.) |
| `/ping` | Latence WebSocket du bot |
| `/list` | Liste toutes les commandes disponibles |
| `/wake` | Réveille le PC via Wake-on-LAN *(owner only)* |
| `/stream <recherche>` | Génère un lien de streaming Jellyfin compatible VRChat (AVPro) *(owner only)* |

### Interactions
| Commande | Description |
|---|---|
| `/hug @user` | Fait un câlin à quelqu'un |
| `/kiss @user` | Fait un bisou à quelqu'un |
| `/nasa AAAA-MM-JJ` | Image astronomique NASA du jour (APOD) |

### Jeux
| Commande | Description |
|---|---|
| `/morpion @user` | Joue au morpion contre un autre joueur |

## Installation

### Prérequis
- Node.js 22+
- Un bot Discord ([guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html))

### Setup

```bash
git clone https://github.com/Axtazer/Axtazia.git
cd Axtazia
npm install
```

Copie `.env.exemple` en `.env` et remplis les variables :

```bash
cp .env.exemple .env
```

### Variables d'environnement

```env
# Discord
DISCORD_TOKEN=        # Token du bot
CLIENT_ID=            # ID de l'application
GUILD_ID=             # ID du serveur Discord
OWNER_ID=             # Ton ID utilisateur Discord

# NASA APOD
NASA_APOD_KEY=        # Clé API NASA (https://api.nasa.gov)

# Wake-on-LAN
WOL_API_URL=          # URL de l'API WoL
WOL_API_TOKEN=        # Token d'auth de l'API WoL

# Jellyfin (/stream)
JELLYFIN_BASE_URL=    # URL du serveur Jellyfin (ex: https://stream.exemple.com)
JELLYFIN_API_KEY=     # Clé API Jellyfin (Dashboard > API Keys)

# Twitch EventSub
TWITCH_CLIENT_ID=         # App Client ID (https://dev.twitch.tv/console)
TWITCH_CLIENT_SECRET=     # App Client Secret
TWITCH_BROADCASTER_ID=    # ID du streamer à surveiller
TWITCH_WEBHOOK_SECRET=    # Secret HMAC aléatoire (openssl rand -hex 32)
TWITCH_WEBHOOK_URL=       # URL publique du bot (ex: https://bot.exemple.com)
TWITCH_WEBHOOK_PORT=3000  # Port du serveur webhook
TWITCH_NOTIFY_CHANNEL_ID= # ID du salon Discord pour les notifs
```

### Démarrage

```bash
# Enregistrer les commandes slash
npm run deploy

# Lancer le bot
npm start

# Développement (hot-reload)
npx nodemon index.js
```

## Déploiement Docker

```bash
docker build -t axtazia .
docker run --env-file .env axtazia
```

L'image est aussi publiée automatiquement sur le GitHub Container Registry à chaque push sur `main` :

```bash
docker pull ghcr.io/axtazer/axtazia:latest
```

## Notifications Twitch

Le bot inclut un serveur webhook HTTP pour recevoir les événements Twitch EventSub. Quand le streamer configuré passe en live, une notification est envoyée dans le salon Discord défini.

**Prérequis :** le bot doit être accessible depuis internet (URL publique). En développement, utilise [ngrok](https://ngrok.com) :

```bash
ngrok http 3000
# puis renseigne l'URL dans TWITCH_WEBHOOK_URL
```

## Structure

```
.
├── commands/
│   ├── games/          # Jeux (morpion)
│   ├── interactions/   # Commandes fun (hug, kiss, nasa)
│   └── utility/        # Utilitaires (ping, bot, list, wake)
├── events/             # Gestionnaires d'événements Discord
├── src/
│   └── twitch/         # Webhook EventSub Twitch
├── index.js            # Point d'entrée
└── deploy-commands.js  # Enregistrement des commandes slash
```

## Licence

[MIT](LICENSE) — Axtazer
