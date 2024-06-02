const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');

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
        fetch('https://nekos.life/api/v2/img/hug').then(picLink => picLink.json()).then(picLink => {
            interaction.reply({ content:`${interaction.user} fais un bisou à ${target}`, files: [picLink.url]});
            });
    },
};