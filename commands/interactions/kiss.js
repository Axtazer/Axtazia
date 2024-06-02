const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');

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
        fetch('https://nekos.life/api/v2/img/kiss').then(picLink => picLink.json()).then(picLink => {
            interaction.reply({ content:`${interaction.user} fais un bisou à ${target}`, files: [picLink.url]})
            });
    },
};