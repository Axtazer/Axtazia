'use strict';

const { EmbedBuilder } = require('discord.js');

/**
 * Obtient un App Access Token Twitch (réutilisé depuis subscriptions, mais indépendant ici).
 * @returns {Promise<string>}
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
 * Récupère les informations d'un stream Twitch en cours.
 * @param {string} token - App Access Token
 * @param {string} userId - ID de l'utilisateur Twitch
 * @returns {Promise<Object|null>}
 */
async function fetchStreamInfo(token, userId) {
    const clientId = process.env.TWITCH_CLIENT_ID;

    const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userId)}`, {
        headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de la récupération du stream (${res.status}): ${text}`);
    }

    const data = await res.json();
    return data.data?.[0] || null;
}

/**
 * Récupère les informations d'un utilisateur Twitch.
 * @param {string} token - App Access Token
 * @param {string} userId - ID de l'utilisateur Twitch
 * @returns {Promise<Object|null>}
 */
async function fetchUserInfo(token, userId) {
    const clientId = process.env.TWITCH_CLIENT_ID;

    const res = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(userId)}`, {
        headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de la récupération de l'utilisateur (${res.status}): ${text}`);
    }

    const data = await res.json();
    return data.data?.[0] || null;
}

/**
 * Envoie une notification Discord quand un streamer passe en live.
 * @param {import('discord.js').Client} client - Le client Discord
 * @param {Object} event - Les données de l'événement EventSub stream.online
 * @param {string} event.broadcaster_user_id - ID du broadcaster
 * @param {string} event.broadcaster_user_name - Nom du broadcaster
 * @param {string} event.broadcaster_user_login - Login du broadcaster
 * @returns {Promise<void>}
 */
async function sendLiveNotification(client, event) {
    const channelId = process.env.TWITCH_NOTIFY_CHANNEL_ID;

    if (!channelId) {
        console.error('[Twitch] TWITCH_NOTIFY_CHANNEL_ID non défini. Notification ignorée.');
        return;
    }

    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.error(`[Twitch] Salon Discord introuvable avec l'ID: ${channelId}`);
        return;
    }

    const userId = event.broadcaster_user_id;
    const userName = event.broadcaster_user_name || event.broadcaster_user_login || 'Streamer inconnu';
    const userLogin = event.broadcaster_user_login || '';

    let token;
    try {
        token = await getAppAccessToken();
    } catch (err) {
        console.error('[Twitch] Impossible d\'obtenir un token pour la notification:', err);
        return;
    }

    // Récupération des infos stream et utilisateur en parallèle
    let streamInfo = null;
    let userInfo = null;

    try {
        [streamInfo, userInfo] = await Promise.all([
            fetchStreamInfo(token, userId),
            fetchUserInfo(token, userId),
        ]);
    } catch (err) {
        console.error('[Twitch] Erreur lors de la récupération des infos Twitch:', err);
        // On continue avec les infos disponibles
    }

    const streamTitle = streamInfo?.title || 'Pas de titre';
    const gameName = streamInfo?.game_name || 'Jeu inconnu';
    const viewerCount = streamInfo?.viewer_count ?? null;
    const profileImage = userInfo?.profile_image_url || null;

    // Thumbnail de la vignette du stream (1280x720), avec cache-busting
    const thumbnailUrl = streamInfo?.thumbnail_url
        ? streamInfo.thumbnail_url
            .replace('{width}', '1280')
            .replace('{height}', '720') + `?t=${Date.now()}`
        : null;

    const twitchUrl = `https://www.twitch.tv/${userLogin}`;

    const embed = new EmbedBuilder()
        .setColor(0x9146FF) // Violet Twitch
        .setTitle(`🔴 ${userName} est en live !`)
        .setURL(twitchUrl)
        .setDescription(`**${streamTitle}**`)
        .addFields(
            { name: 'Jeu', value: gameName, inline: true },
            ...(viewerCount !== null
                ? [{ name: 'Spectateurs', value: viewerCount.toString(), inline: true }]
                : []),
        )
        .setFooter({ text: 'Twitch' })
        .setTimestamp();

    if (thumbnailUrl) {
        embed.setImage(thumbnailUrl);
    }

    if (profileImage) {
        embed.setThumbnail(profileImage);
    }

    try {
        await channel.send({
            content: `**${userName}** est maintenant en live sur Twitch ! 🎮`,
            embeds: [embed],
        });
        console.log(`[Twitch] Notification envoyée dans le salon ${channelId} pour ${userName}`);
    } catch (err) {
        console.error('[Twitch] Erreur lors de l\'envoi du message Discord:', err);
    }
}

module.exports = { sendLiveNotification };
