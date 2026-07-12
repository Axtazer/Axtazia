'use strict';

const TOKEN_URL = 'https://discord.com/api/v10/oauth2/token';
const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const SCOPE = 'application_identities.write';

/**
 * Construit l'URL d'autorisation OAuth2 à visiter manuellement (une seule fois).
 * @returns {string}
 */
function buildAuthorizeUrl() {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI;

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);

    return url.toString();
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
        console.warn('[OAuth] Discord a fourni un nouveau refresh_token. Mets à jour DISCORD_OAUTH_REFRESH_TOKEN dans 1Password pour éviter une perte d\'accès au prochain redémarrage:', currentRefreshToken);
    }

    return cachedAccessToken;
}

module.exports = { buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, getValidAccessToken };
