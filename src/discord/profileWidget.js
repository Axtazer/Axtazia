'use strict';

const { getValidAccessToken } = require('./oauth');

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://vmsingle-victoria-metrics-k8s-stack.monitoring.svc.cluster.local:8428';

/**
 * Formate une durée en secondes en chaîne courte (ex: 93132 -> "1d 2h 12m").
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatUptime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (days || hours) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(' ');
}

/**
 * Récupère l'uptime du node (en secondes) via Prometheus (node_boot_time_seconds).
 * @returns {Promise<number>}
 */
async function fetchServerUptimeSeconds() {
    const url = new URL('/api/v1/query', PROMETHEUS_URL);
    url.searchParams.set('query', 'node_boot_time_seconds');

    const res = await fetch(url.toString());

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de la requête Prometheus (${res.status}): ${text}`);
    }

    const data = await res.json();
    const result = data.data?.result?.[0];

    if (!result) {
        throw new Error('Aucune métrique node_boot_time_seconds retournée par Prometheus.');
    }

    const bootTime = Number(result.value[1]);
    return Date.now() / 1000 - bootTime;
}

/**
 * Met à jour le widget de profil (identity profile) avec l'uptime formaté.
 * Le profil ciblé est celui du compte propriétaire (OWNER_ID) qui a autorisé
 * l'application via OAuth2 (scope application_identities.write), pas le bot.
 * @param {string} formattedUptime
 * @returns {Promise<void>}
 */
async function updateProfileWidget(formattedUptime) {
    const applicationId = process.env.CLIENT_ID;
    const userId = process.env.OWNER_ID;
    const accessToken = await getValidAccessToken();

    const url = `https://discord.com/api/v9/applications/${applicationId}/users/${userId}/identities/0/profile`;

    const body = {
        data: {
            dynamic: [
                { type: 1, name: 'uptime', value: formattedUptime },
            ],
        },
    };

    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'DiscordBot (https://github.com/Axtazer/Axtazia, 1.0.0)',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Échec de la mise à jour du widget de profil (${res.status}): ${text}`);
    }
}

const TEN_MINUTES = 10 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;
const ONE_DAY_SECONDS = 24 * 60 * 60;

let refreshTimeout = null;

/**
 * Rafraîchit le widget de profil et reprogramme le prochain rafraîchissement.
 * Fréquence adaptative : 10 min si uptime < 24h, sinon 30 min.
 */
async function refreshAndReschedule() {
    let nextDelay = TEN_MINUTES;

    try {
        const uptimeSeconds = await fetchServerUptimeSeconds();
        await updateProfileWidget(formatUptime(uptimeSeconds));
        nextDelay = uptimeSeconds < ONE_DAY_SECONDS ? TEN_MINUTES : THIRTY_MINUTES;
    } catch (err) {
        console.error('[ProfileWidget] Erreur lors du rafraîchissement de l\'uptime:', err);
    }

    refreshTimeout = setTimeout(refreshAndReschedule, nextDelay);
}

/**
 * Démarre le cycle de mise à jour périodique du widget de profil.
 * Ne fait rien si l'autorisation OAuth2 initiale n'a pas encore été effectuée.
 */
function startProfileWidgetUpdates() {
    if (refreshTimeout) return;
    if (!process.env.DISCORD_OAUTH_REFRESH_TOKEN) {
        console.warn('[ProfileWidget] DISCORD_OAUTH_REFRESH_TOKEN non défini, widget désactivé. Visite l\'URL retournée par buildAuthorizeUrl() pour l\'autoriser.');
        return;
    }
    refreshAndReschedule();
}

module.exports = { formatUptime, fetchServerUptimeSeconds, updateProfileWidget, startProfileWidgetUpdates };
