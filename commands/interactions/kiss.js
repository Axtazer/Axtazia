const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('Faites un bisou à qui vous voulez !')
        .addUserOption(option =>
			option
				.setName('target')
				.setDescription('A qui voudriez-vous faire un bisou ? 💕')
				.setRequired(true)),
    
    async execute(interaction) {3
        const target = interaction.options.getUser('target');
        const picResult = await axios.get('https://nekos.life/api/v2/img/kiss');
		const picLink = await picResult.data.url;

        await interaction.reply({ content:`${interaction.user} fais un câlin à ${target}`, files: [picLink]})

    }
};