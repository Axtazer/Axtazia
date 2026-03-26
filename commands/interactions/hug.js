const { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Faites des câlins à qui vous voulez !')
        .addUserOption(option =>
			option
				.setName('target')
				.setDescription('Qui voulez-vous câliner ? 💖')
				.setRequired(true)),
        /**
         * @param {ChatInputCommandInteraction} interaction
         */
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        try {
            const response = await fetch('https://nekos.life/api/v2/img/hug');
            const picLink = await response.json();
            await interaction.reply({ content: `${interaction.user} fait un câlin à ${target}`, files: [picLink.url] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue. Veuillez réessayer plus tard.', flags: MessageFlags.Ephemeral });
        }
    },
};