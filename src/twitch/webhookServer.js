'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { sendLiveNotification } = require('./notifier');

const TWITCH_MESSAGE_ID = 'twitch-eventsub-message-id';
const TWITCH_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const TWITCH_MESSAGE_SIGNATURE = 'twitch-eventsub-message-signature';
const TWITCH_MESSAGE_TYPE = 'twitch-eventsub-message-type';

const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

// Les payloads EventSub font quelques Ko : au-delà, la requête est rejetée avant d'être bufferisée
const MAX_BODY_BYTES = 64 * 1024;
// Twitch recommande de rejeter les messages de plus de 10 minutes (anti-rejeu)
const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000;

// IDs des messages déjà traités (Twitch renvoie un message non acquitté à temps) : id -> date de réception
const seenMessageIds = new Map();

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
 * Vérifie que le timestamp du message date de moins de 10 minutes.
 * @param {string} timestamp - Header twitch-eventsub-message-timestamp (RFC3339)
 * @returns {boolean}
 */
function isRecent(timestamp) {
    const sentAt = Date.parse(timestamp);
    if (Number.isNaN(sentAt)) return false;
    return Math.abs(Date.now() - sentAt) <= MAX_MESSAGE_AGE_MS;
}

/**
 * Indique si le message a déjà été traité, et le mémorise sinon.
 * Les IDs plus vieux que la fenêtre anti-rejeu sont purgés (ils seraient rejetés par isRecent).
 * @param {string} messageId
 * @returns {boolean}
 */
function isDuplicate(messageId) {
    const now = Date.now();
    for (const [id, receivedAt] of seenMessageIds) {
        if (now - receivedAt > MAX_MESSAGE_AGE_MS) seenMessageIds.delete(id);
    }

    if (seenMessageIds.has(messageId)) return true;
    seenMessageIds.set(messageId, now);
    return false;
}

/**
 * Lit le corps complet d'une requête HTTP, dans la limite de MAX_BODY_BYTES.
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                const err = new Error('Corps de requête trop volumineux.');
                err.code = 'BODY_TOO_LARGE';
                req.removeAllListeners('data');
                req.resume();
                reject(err);
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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
        // Sonde de vie (non exposée par l'Ingress) : 200 tant que le client Discord est connecté
        if (req.method === 'GET' && req.url === '/healthz') {
            const ready = client.isReady();
            res.writeHead(ready ? 200 : 503, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(ready ? 'ok' : 'discord not ready');
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
            if (err.code === 'BODY_TOO_LARGE') {
                console.warn('[Twitch] Corps de requête trop volumineux, requête rejetée.');
                res.writeHead(413, { Connection: 'close' });
                res.end();
                return;
            }
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

        // Message trop ancien : possible rejeu d'une requête signée interceptée
        if (!isRecent(req.headers[TWITCH_MESSAGE_TIMESTAMP])) {
            console.warn('[Twitch] Message trop ancien, requête rejetée.');
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

            // Renvoi d'un message déjà traité : on l'acquitte sans renotifier
            if (isDuplicate(req.headers[TWITCH_MESSAGE_ID])) {
                console.log('[Twitch] Message déjà traité, ignoré.');
                return;
            }

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
