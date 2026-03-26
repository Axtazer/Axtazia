const { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('Faites un bisou à qui vous voulez !')
        .addUserOption(option =>
			option
				.setName('target')
				.setDescription('A qui voudriez-vous faire un bisou ? 💕')
				.setRequired(true)),
        /**
         * @param {ChatInputCommandInteraction} interaction
         */
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        try {
            const response = await fetch('https://nekos.life/api/v2/img/kiss');
            const picLink = await response.json();
            await interaction.reply({ content: `${interaction.user} fais un bisou à ${target}`, files: [picLink.url] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue. Veuillez réessayer plus tard.', flags: MessageFlags.Ephemeral });
        }
    },
};