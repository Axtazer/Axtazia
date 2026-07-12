'use strict';

const crypto = require('node:crypto');

const TOKEN_URL = 'https://discord.com/api/v10/oauth2/token';
const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const SCOPE = 'application_identities.write';
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Signe un state pour le protéger contre la falsification (CSRF), sans stockage
 * côté serveur : la validité tient à la signature HMAC + un TTL sur le timestamp.
 * Reste valide à travers un redémarrage du process (contrairement à un Map en mémoire).
 * @param {number} timestamp
 * @returns {string}
 */
function signState(timestamp) {
    const secret = process.env.DISCORD_CLIENT_SECRET;
    const hmac = crypto.createHmac('sha256', secret).update(String(timestamp)).digest('base64url');
    return `${timestamp}.${hmac}`;
}

/**
 * Construit l'URL d'autorisation OAuth2 à visiter manuellement (une seule fois).
 * Inclut un state signé pour se protéger du CSRF.
 * @returns {string}
 */
function buildAuthorizeUrl() {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;
    const state = signState(Date.now());

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);

    return url.toString();
}

/**
 * Vérifie un state reçu sur le callback OAuth2 (signature + fraîcheur, protection CSRF).
 * @param {string} state
 * @returns {boolean}
 */
function consumeState(state) {
    const [timestampRaw, hmac] = String(state).split('.');
    if (!timestampRaw || !hmac) return false;

    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > STATE_TTL_MS || timestamp > Date.now()) {
        return false;
    }

    const expected = signState(timestamp).split('.')[1];
    const a = Buffer.from(hmac);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
}

/**
 * Échange un code d'autorisation contre un access_token + refresh_token.
 * @param {string} code
 * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number}>}
 */
async function exchangeCodeForToken(code) {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
    });

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de l'échange du code OAuth2 (${res.status}): ${text}`);
    }

    return res.json();
}

/**
 * Rafraîchit un access_token à partir d'un refresh_token.
 * @param {string} refreshToken
 * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number}>}
 */
async function refreshAccessToken(refreshToken) {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec du rafraîchissement du token OAuth2 (${res.status}): ${text}`);
    }

    return res.json();
}

/**
 * Empreinte courte non-sensible d'un secret, utilisable dans les logs pour corrélation.
 * @param {string} secret
 * @returns {string}
 */
function fingerprint(secret) {
    return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8);
}

let cachedAccessToken = null;
let cachedExpiresAt = 0;
// Refresh token courant, initialisé depuis l'env mais mis à jour en mémoire
// si Discord en renvoie un nouveau lors d'un refresh (rotation de token).
let currentRefreshToken = process.env.DISCORD_OAUTH_REFRESH_TOKEN;

const EXPIRY_SAFETY_MARGIN_MS = 60 * 1000;

/**
 * Retourne un access_token OAuth2 valide, en le rafraîchissant si nécessaire.
 * @returns {Promise<string>}
 */
async function getValidAccessToken() {
    if (!currentRefreshToken) {
        throw new Error('DISCORD_OAUTH_REFRESH_TOKEN non défini. Autorisation manuelle requise (voir buildAuthorizeUrl).');
    }

    if (cachedAccessToken && Date.now() < cachedExpiresAt - EXPIRY_SAFETY_MARGIN_MS) {
        return cachedAccessToken;
    }

    const tokens = await refreshAccessToken(currentRefreshToken);
    cachedAccessToken = tokens.access_token;
    cachedExpiresAt = Date.now() + tokens.expires_in * 1000;
    if (tokens.refresh_token && tokens.refresh_token !== currentRefreshToken) {
        currentRefreshToken = tokens.refresh_token;
        console.warn(`[OAuth] Discord a fourni un nouveau refresh_token (${fingerprint(currentRefreshToken)}). Mets à jour DISCORD_OAUTH_REFRESH_TOKEN dans 1Password pour éviter une perte d'accès au prochain redémarrage.`);
    }

    return cachedAccessToken;
}

module.exports = { buildAuthorizeUrl, consumeState, exchangeCodeForToken, refreshAccessToken, getValidAccessToken };
