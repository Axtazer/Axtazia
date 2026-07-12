'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { sendLiveNotification } = require('./notifier');
const { exchangeCodeForToken, consumeState } = require('../discord/oauth');

const TWITCH_MESSAGE_ID = 'twitch-eventsub-message-id';
const TWITCH_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const TWITCH_MESSAGE_SIGNATURE = 'twitch-eventsub-message-signature';
const TWITCH_MESSAGE_TYPE = 'twitch-eventsub-message-type';

const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

/**
 * Vérifie la signature HMAC-SHA256 de la requête Twitch.
 * @param {string} secret - Le secret HMAC configuré
 * @param {http.IncomingMessage} req - La requête HTTP
 * @param {string} body - Le corps brut de la requête (string)
 * @returns {boolean}
 */
function verifySignature(secret, req, body) {
    const messageId = req.headers[TWITCH_MESSAGE_ID];
    const timestamp = req.headers[TWITCH_MESSAGE_TIMESTAMP];
    const signature = req.headers[TWITCH_MESSAGE_SIGNATURE];

    if (!messageId || !timestamp || !signature) return false;

    const hmacMessage = messageId + timestamp + body;
    const hmac = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(hmacMessage)
        .digest('hex');

    // Comparaison en temps constant pour éviter les timing attacks
    try {
        return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
    } catch {
        return false;
    }
}

/**
 * Lit le corps complet d'une requête HTTP.
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

/**
 * Démarre le serveur HTTP pour recevoir les webhooks Twitch EventSub.
 * @param {import('discord.js').Client} client - Le client Discord
 */
function startWebhookServer(client) {
    const port = process.env.TWITCH_WEBHOOK_PORT || 3000;
    const secret = process.env.TWITCH_WEBHOOK_SECRET;

    if (!secret) {
        console.error('[Twitch] TWITCH_WEBHOOK_SECRET non défini. Le serveur webhook ne démarrera pas.');
        return;
    }

    const server = http.createServer(async (req, res) => {
        // Callback OAuth2 Discord (autorisation manuelle unique pour le widget de profil)
        if (req.method === 'GET' && req.url.startsWith('/oauth/callback/discord')) {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const code = params.get('code');
            const state = params.get('state');

            if (!code || !state || !consumeState(state)) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Requête invalide ou expirée (code/state manquant ou incorrect). Relance buildAuthorizeUrl().');
                return;
            }

            try {
                const tokens = await exchangeCodeForToken(code);
                console.log('[OAuth] Autorisation réussie, refresh_token obtenu.');
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Autorisation réussie. Copie ce refresh_token dans 1Password (DISCORD_OAUTH_REFRESH_TOKEN) puis ferme cette page :\n\n${tokens.refresh_token}`);
            } catch (err) {
                console.error('[OAuth] Échec de l\'échange du code:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Échec de l\'autorisation, voir les logs du bot.');
            }
            return;
        }

        // On ne traite que POST /webhook/twitch
        if (req.method !== 'POST' || req.url !== '/webhook/twitch') {
            res.writeHead(404);
            res.end();
            return;
        }

        let body;
        try {
            body = await readBody(req);
        } catch (err) {
            console.error('[Twitch] Erreur lecture du corps de la requête:', err);
            res.writeHead(400);
            res.end();
            return;
        }

        // Vérification de la signature
        if (!verifySignature(secret, req, body)) {
            console.warn('[Twitch] Signature invalide reçue, requête rejetée.');
            res.writeHead(403);
            res.end();
            return;
        }

        let payload;
        try {
            payload = JSON.parse(body);
        } catch (err) {
            console.error('[Twitch] Corps JSON invalide:', err);
            res.writeHead(400);
            res.end();
            return;
        }

        const messageType = req.headers[TWITCH_MESSAGE_TYPE];

        // Challenge de vérification d'abonnement
        if (messageType === MESSAGE_TYPE_VERIFICATION) {
            const challenge = payload.challenge;
            console.log('[Twitch] Challenge de vérification reçu, réponse envoyée.');
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(challenge);
            return;
        }

        // Révocation d'abonnement
        if (messageType === MESSAGE_TYPE_REVOCATION) {
            console.warn(`[Twitch] Abonnement révoqué: ${payload.subscription?.type} — raison: ${payload.subscription?.status}`);
            res.writeHead(204);
            res.end();
            return;
        }

        // Notification d'événement
        if (messageType === MESSAGE_TYPE_NOTIFICATION) {
            const subscriptionType = payload.subscription?.type;

            res.writeHead(204);
            res.end();

            if (subscriptionType === 'stream.online') {
                console.log(`[Twitch] Événement stream.online reçu pour broadcaster_id: ${payload.event?.broadcaster_user_id}`);
                try {
                    await sendLiveNotification(client, payload.event);
                } catch (err) {
                    console.error('[Twitch] Erreur lors de l\'envoi de la notification Discord:', err);
                }
            }

            return;
        }

        // Type inconnu
        res.writeHead(204);
        res.end();
    });

    server.on('error', err => {
        console.error('[Twitch] Erreur du serveur webhook:', err);
    });

    server.listen(port, () => {
        console.log(`[Twitch] Serveur webhook démarré sur le port ${port}`);
    });
}

module.exports = { startWebhookServer };
