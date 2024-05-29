const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Faites des câlins à qui vous voulez !')
        .addUserOption(option =>
			option
				.setName('target')
				.setDescription('Qui voulez-vous câliner ? 💖')
				.setRequired(true)),
    
    async execute(interaction) {3
        const target = interaction.options.getUser('target');
        const picResult = await axios.get('https://nekos.life/api/v2/img/hug');
		const picLink = await picResult.data.url;

        await interaction.reply({ content:`${interaction.user} fais un bisou à ${target}`, files: [picLink]})

    }
};