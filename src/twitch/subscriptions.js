'use strict';

/**
 * Obtient un App Access Token Twitch via client_credentials.
 * @returns {Promise<string>} Le token d'accès
 */
async function getAppAccessToken() {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET non définis.');
    }

    const url = new URL('https://id.twitch.tv/oauth2/token');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('client_secret', clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');

    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de l'obtention du token Twitch (${res.status}): ${text}`);
    }

    const data = await res.json();
    return data.access_token;
}

/**
 * Vérifie si un abonnement stream.online existe déjà pour le broadcaster donné.
 * @param {string} token - App Access Token
 * @param {string} broadcasterId - ID du broadcaster
 * @returns {Promise<boolean>}
 */
async function subscriptionExists(token, broadcasterId) {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const callbackUrl = (process.env.TWITCH_WEBHOOK_URL || '') + '/webhook/twitch';

    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de la vérification des abonnements (${res.status}): ${text}`);
    }

    const data = await res.json();
    const existing = (data.data || []).find(sub =>
        sub.type === 'stream.online' &&
        sub.condition?.broadcaster_user_id === broadcasterId &&
        sub.transport?.callback === callbackUrl &&
        (sub.status === 'enabled' || sub.status === 'webhook_callback_verification_pending')
    );

    return Boolean(existing);
}

/**
 * Crée un abonnement EventSub stream.online pour le broadcaster donné.
 * @param {string} token - App Access Token
 * @param {string} broadcasterId - ID du broadcaster
 * @returns {Promise<void>}
 */
async function createSubscription(token, broadcasterId) {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const webhookUrl = process.env.TWITCH_WEBHOOK_URL;
    const secret = process.env.TWITCH_WEBHOOK_SECRET;

    if (!webhookUrl) {
        throw new Error('TWITCH_WEBHOOK_URL non défini.');
    }
    if (!secret) {
        throw new Error('TWITCH_WEBHOOK_SECRET non défini.');
    }

    const body = {
        type: 'stream.online',
        version: '1',
        condition: {
            broadcaster_user_id: broadcasterId,
        },
        transport: {
            method: 'webhook',
            callback: webhookUrl + '/webhook/twitch',
            secret: secret,
        },
    };

    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de la création de l'abonnement (${res.status}): ${text}`);
    }

    console.log(`[Twitch] Abonnement stream.online créé pour broadcaster_id: ${broadcasterId}`);
}

/**
 * S'abonne à l'événement stream.online pour un broadcaster.
 * Vérifie d'abord si l'abonnement existe déjà avant de le créer.
 * @param {string} broadcasterId - ID du broadcaster Twitch
 * @returns {Promise<void>}
 */
async function subscribeToStreamOnline(broadcasterId) {
    if (!broadcasterId) {
        console.error('[Twitch] TWITCH_BROADCASTER_ID non défini. Abonnement ignoré.');
        return;
    }

    try {
        const token = await getAppAccessToken();

        const alreadyExists = await subscriptionExists(token, broadcasterId);
        if (alreadyExists) {
            console.log(`[Twitch] Abonnement stream.online déjà actif pour broadcaster_id: ${broadcasterId}`);
            return;
        }

        await createSubscription(token, broadcasterId);
    } catch (err) {
        console.error('[Twitch] Erreur lors de l\'abonnement EventSub:', err);
    }
}

module.exports = { subscribeToStreamOnline };
