const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } = require('discord.js');
const APODkey = process.env.NASA_APOD_KEY;
const ownerId = process.env.OWNER_ID;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nasa')
        .setDescription('Réclame une image de la NASA pour la date spécifiée.')
        .addStringOption(option =>
            option.setName('date')
                .setDescription("Insérer une date au format AAAA-MM-JJ")
                .setRequired(true)),
    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const dateInput = interaction.options.getString('date');
        const client = interaction.client;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return interaction.reply({ content: '❌ Format de date invalide. Utilisez le format `AAAA-MM-JJ` (ex: `2024-01-15`).', flags: MessageFlags.Ephemeral });
        }

        try {
            const owner = await client.users.fetch(ownerId);
            const bot = client.user;

            // thumbs=true : fournit thumbnail_url quand l'APOD du jour est une vidéo
            const params = new URLSearchParams({ api_key: APODkey, date: dateInput, thumbs: 'true' });
            const response = await fetch(`https://api.nasa.gov/planetary/apod?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const nasaData = await response.json();
            
            // Réduit l'explication/description de limage si plus de 1024 caractères
            let explanation = nasaData.explanation;
            const maxLength = 1024;
            if (explanation.length > maxLength) {
                explanation = explanation.substring(0, maxLength - 128) + "*\n\n***La description a été réduite, car si non, il m'est impossible de remplir ma mission.**";
            }

            // Image : hdurl si possible, sinon url classique. Vidéo : la miniature (url pointe vers un lecteur embarqué)
            const isVideo = nasaData.media_type !== 'image';
            const imageUrl = isVideo ? nasaData.thumbnail_url : (nasaData.hdurl || nasaData.url);

            // Création de l'embed
            const nasaEmbed = new EmbedBuilder()
                .setColor(0x0032A0)
                .setTitle("Image de la NASA")
                .setAuthor({ name: "NASA - APOD", url: 'https://apod.nasa.gov/' })
                .setDescription("Voici une image du site de la NASA (APOD - API).")
                .addFields(
                    { name: "Titre", value: nasaData.title, inline: false },
                    { name: "Date de l'image", value: nasaData.date, inline: false },
                    { name: 'Explications', value: explanation, inline: false }
                )
                .setFooter({ text: `${bot.displayName} par ${owner.displayName} avec le 🫀`, iconURL: owner.avatarURL() });

            if (imageUrl) {
                nasaEmbed.setImage(imageUrl);
            }
            if (isVideo && nasaData.url) {
                nasaEmbed.addFields({ name: 'Vidéo', value: nasaData.url, inline: false });
            }

            await interaction.reply({ embeds: [nasaEmbed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Il y a eu une erreur en récupérant l\'image de la NASA. Veuillez réessayer plus tard.', flags: MessageFlags.Ephemeral });
        }
    },
};
