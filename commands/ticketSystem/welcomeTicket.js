const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageComponentInteraction } = require('discord.js');
const { ownerId, clientId } = require('../../config.json');

module.exports = {
    // Slash command data
	data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('!! EN CONSTRUCTION !! Ouvrez un ticket.')
        .addStringOption(option =>
            option.setName('sujet')
                .setDescription('Sujet de votre ticket.')
                .setRequired(true)
                .addChoices(
                    { name: 'Report', value: 'Report' },
                    { name: 'Discord', value: 'Discord' },
                    { name: 'Suggestion', value: 'Suggestion' },
                    { name: 'Accès jeu/stream', value: 'Accèss' },
                    { name: 'Question(s)',value: 'Question(s)' },
                    { name: 'Autre',value: 'Autre' },
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        /**
         * @param {ChatInputCommandInteraction} interaction
         */
    // Début de l'éxécution
	async execute(interaction) {
		const sujet = interaction.options.getString('sujet');
        const client = interaction.client;
        const owner = await client.users.fetch(ownerId);
        const bot = await client.users.fetch(clientId);

        // Définition du bouton
		const close = new ButtonBuilder()
			.setCustomId('close')
			.setLabel('Fermer le ticket')
			.setStyle(ButtonStyle.Danger)
            .setEmoji({name: '🔒'});

		const buttons = new ActionRowBuilder()
			.addComponents(close);

        // Création de l'embed ouverture ticket
        const welcomeTicket = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`👋 Bienvenue !`)
        .setDescription(`Motif du ticket : ${sujet}\n**🎟️ Crée par** ${interaction.user}`)
        .setThumbnail(interaction.user.avatarURL())
        .addFields(
            { name: '⏰ En attendant', value: "N'hésitez pas à décrire le motif de la création de ce ticket avec le plus de détails.\nCela permettras de fournir une réponse précise à votre demande.", inline: false },
            { name: '🤏 Encore un peu', value: "Merci d'attendre et de pas mentionner le staff. Ils arrivent très vite ^^", inline: false },
        )
        .setFooter({ text: `${bot.displayName} par ${owner.displayName} avec le 🫀`, iconURL: owner.avatarURL() });
        
        // Envoie de l'embed + boutton
        await interaction.reply({ embeds: [welcomeTicket], components: [buttons], ephemeral: true });
        
        // Fermer le ticket
        const collectorFilter = i => i.user.id === interaction.user.id;
            const confirmation = await response.awaitMessageComponent({ filter: collectorFilter });
        
            if (confirmation.customId === 'confirm') {
                await interaction.guild.channels.delete(interaction.channelId);
                await confirmation.update({ content: `Le ticket **${interaction.channel}** à était fermer.`, components: [] });
            } else if (confirmation.customId === 'cancel') {
                await confirmation.update({ content: 'Annuler la fermeture', components: [] });
            }
    },       
};
