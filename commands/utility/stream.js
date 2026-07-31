const {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	AutocompleteInteraction,
	StringSelectMenuInteraction,
	StringSelectMenuBuilder,
	ActionRowBuilder,
	MessageFlags,
} = require('discord.js');
const { searchHints, getSeasons, getEpisodes, buildStreamUrl } = require('../../src/jellyfin/client');

const OWNER_ID = process.env.OWNER_ID;

const TYPE_LABELS = { Movie: 'Film', Series: 'Série', Episode: 'Épisode' };
const VALID_TYPES = new Set(Object.keys(TYPE_LABELS));

/**
 * Seul le propriétaire du serveur (guild.ownerId) ou le propriétaire du bot (OWNER_ID)
 * peut utiliser cette commande, quel que soit le serveur.
 * @param {ChatInputCommandInteraction|StringSelectMenuInteraction} interaction
 * @returns {boolean}
 */
function isAuthorized(interaction) {
	if (interaction.user.id === OWNER_ID) return true;
	return Boolean(interaction.guild && interaction.guild.ownerId === interaction.user.id);
}

/**
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength) {
	if (str.length <= maxLength) return str;
	return `${str.slice(0, maxLength - 1)}…`;
}

/**
 * Parse la value d'une option choisie via autocomplete: "Type:ItemId".
 * @param {string} raw
 * @returns {{ type: string, itemId: string }|null}
 */
function parseSelection(raw) {
	const separatorIndex = raw.indexOf(':');
	if (separatorIndex === -1) return null;

	const type = raw.slice(0, separatorIndex);
	const itemId = raw.slice(separatorIndex + 1);

	if (!VALID_TYPES.has(type) || !itemId) return null;
	return { type, itemId };
}

/**
 * @param {string} url
 * @returns {string}
 */
function formatStreamMessage(url) {
	return [
		'🎬 Lien de streaming prêt :',
		url,
		'',
		'⚠️ Dans VRChat, clique sur **"Trust This URL"** au premier chargement de la vidéo.',
	].join('\n');
}

/**
 * @param {string} seriesId
 * @param {Array<object>} seasons
 * @returns {ActionRowBuilder}
 */
function buildSeasonSelectRow(seriesId, seasons) {
	const options = seasons.slice(0, 25).map(season => ({
		label: truncate(season.Name || `Saison ${season.IndexNumber ?? '?'}`, 100),
		value: season.Id,
	}));

	const menu = new StringSelectMenuBuilder()
		.setCustomId(`stream_season:${seriesId}`)
		.setPlaceholder('Choisis une saison')
		.addOptions(options);

	return new ActionRowBuilder().addComponents(menu);
}

/**
 * @param {Array<object>} episodes
 * @returns {ActionRowBuilder}
 */
function buildEpisodeSelectRow(episodes) {
	const options = episodes.slice(0, 25).map(episode => ({
		label: truncate(
			episode.IndexNumber ? `${episode.IndexNumber}. ${episode.Name}` : episode.Name,
			100,
		),
		value: episode.Id,
	}));

	const menu = new StringSelectMenuBuilder()
		.setCustomId('stream_episode')
		.setPlaceholder('Choisis un épisode')
		.addOptions(options);

	return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stream')
		.setDescription('Génère un lien de streaming Jellyfin compatible VRChat (AVPro).')
		.addStringOption(option =>
			option
				.setName('recherche')
				.setDescription("Titre du film, de la série ou de l'épisode à chercher")
				.setRequired(true)
				.setAutocomplete(true),
		),

	/**
	 * @param {AutocompleteInteraction} interaction
	 */
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused();

		if (!focused || focused.trim().length === 0) {
			return interaction.respond([]);
		}

		try {
			const hints = await searchHints(focused, 10);
			const choices = hints
				.filter(hint => hint.ItemId && VALID_TYPES.has(hint.Type))
				.slice(0, 25)
				.map(hint => {
					const typeLabel = TYPE_LABELS[hint.Type];
					const year = hint.ProductionYear ? ` (${hint.ProductionYear})` : '';
					return {
						name: truncate(`${hint.Name}${year} — ${typeLabel}`, 100),
						value: truncate(`${hint.Type}:${hint.ItemId}`, 100),
					};
				});

			await interaction.respond(choices);
		} catch (error) {
			console.error('[Stream] Erreur autocomplete Jellyfin:', error);
			await interaction.respond([]);
		}
	},

	/**
	 * @param {ChatInputCommandInteraction} interaction
	 */
	async execute(interaction) {
		if (!isAuthorized(interaction)) {
			return interaction.reply({
				content: 'Cette commande est réservée au propriétaire du bot ou du serveur.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const raw = interaction.options.getString('recherche', true);
		const parsed = parseSelection(raw);

		if (!parsed) {
			return interaction.reply({
				content: "Sélectionne un résultat proposé par l'autocomplétion plutôt que de saisir du texte libre.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			if (parsed.type === 'Series') {
				const seasons = await getSeasons(parsed.itemId);

				if (seasons.length === 0) {
					return interaction.editReply('Aucune saison trouvée pour cette série.');
				}

				const row = buildSeasonSelectRow(parsed.itemId, seasons);
				return interaction.editReply({ content: 'Choisis une saison :', components: [row] });
			}

			const url = buildStreamUrl(parsed.itemId);
			return interaction.editReply(formatStreamMessage(url));
		} catch (error) {
			console.error('[Stream] Erreur Jellyfin:', error);
			return interaction.editReply('Une erreur est survenue lors de la communication avec Jellyfin.');
		}
	},

	/**
	 * @param {StringSelectMenuInteraction} interaction
	 */
	async handleStreamSelect(interaction) {
		if (!isAuthorized(interaction)) {
			return interaction.reply({
				content: 'Cette commande est réservée au propriétaire du bot ou du serveur.',
				flags: MessageFlags.Ephemeral,
			});
		}

		if (interaction.customId.startsWith('stream_season:')) {
			const seriesId = interaction.customId.slice('stream_season:'.length);
			const seasonId = interaction.values[0];

			await interaction.deferUpdate();

			try {
				const episodes = await getEpisodes(seriesId, seasonId);

				if (episodes.length === 0) {
					return interaction.editReply({ content: 'Aucun épisode trouvé pour cette saison.', components: [] });
				}

				const row = buildEpisodeSelectRow(episodes);
				return interaction.editReply({ content: 'Choisis un épisode :', components: [row] });
			} catch (error) {
				console.error('[Stream] Erreur récupération épisodes Jellyfin:', error);
				return interaction.editReply({
					content: 'Une erreur est survenue lors de la récupération des épisodes.',
					components: [],
				});
			}
		}

		if (interaction.customId === 'stream_episode') {
			const itemId = interaction.values[0];
			const url = buildStreamUrl(itemId);
			return interaction.update({ content: formatStreamMessage(url), components: [] });
		}
	},
};
