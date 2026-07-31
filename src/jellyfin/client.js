'use strict';

/**
 * Lit et valide la config Jellyfin depuis l'environnement.
 * @returns {{ baseUrl: string, apiKey: string }}
 */
function getConfig() {
    const baseUrl = process.env.JELLYFIN_BASE_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!baseUrl || !apiKey) {
        throw new Error('JELLYFIN_BASE_URL ou JELLYFIN_API_KEY non défini(e).');
    }

    return { baseUrl, apiKey };
}

/**
 * Effectue un GET authentifié vers l'API Jellyfin.
 * @param {string} pathname - Chemin de l'endpoint (ex: '/Search/Hints')
 * @param {Record<string, string|number>} params - Paramètres de requête additionnels
 * @returns {Promise<any>}
 */
async function jellyfinGet(pathname, params) {
    const { baseUrl, apiKey } = getConfig();
    const url = new URL(pathname, baseUrl);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    url.searchParams.set('api_key', apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
        throw new Error(`Requête Jellyfin échouée (${res.status}) sur ${pathname}`);
    }

    return res.json();
}

/**
 * Recherche des films/séries/épisodes correspondant au terme donné.
 * @param {string} searchTerm
 * @param {number} limit
 * @returns {Promise<Array<object>>}
 */
async function searchHints(searchTerm, limit = 10) {
    const data = await jellyfinGet('/Search/Hints', {
        searchTerm,
        limit,
        IncludeItemTypes: 'Movie,Series,Episode',
    });
    return data.SearchHints || [];
}

/**
 * Récupère les saisons d'une série.
 * @param {string} seriesId
 * @returns {Promise<Array<object>>}
 */
async function getSeasons(seriesId) {
    const data = await jellyfinGet(`/Shows/${seriesId}/Seasons`, {});
    return data.Items || [];
}

/**
 * Récupère les épisodes d'une saison précise (jamais toute la série d'un coup).
 * @param {string} seriesId
 * @param {string} seasonId
 * @returns {Promise<Array<object>>}
 */
async function getEpisodes(seriesId, seasonId) {
    const data = await jellyfinGet(`/Shows/${seriesId}/Episodes`, { seasonId });
    return data.Items || [];
}

/**
 * Construit l'URL de streaming MP4 transcodé (H.264/AAC), compatible VRChat/AVPro.
 * @param {string} itemId
 * @returns {string}
 */
function buildStreamUrl(itemId) {
    const { baseUrl, apiKey } = getConfig();
    const url = new URL(`/Videos/${itemId}/stream.mp4`, baseUrl);

    url.searchParams.set('VideoCodec', 'h264');
    url.searchParams.set('AudioCodec', 'aac');
    url.searchParams.set('AudioBitrate', '192000');
    url.searchParams.set('MaxAudioChannels', '2');
    url.searchParams.set('VideoBitrate', '8000000');
    url.searchParams.set('MaxWidth', '1920');
    url.searchParams.set('MaxHeight', '1080');
    url.searchParams.set('api_key', apiKey);

    return url.toString();
}

module.exports = { searchHints, getSeasons, getEpisodes, buildStreamUrl };
