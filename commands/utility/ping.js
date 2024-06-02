const { SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Donne le ping du bot.'),
        /**
        * @param {ChatInputCommandInteraction} interaction
        */
    async execute(interaction) {
        const client = interaction.client
        await interaction.reply({ content: `🏓 **${client.ws.ping}** ms !`, ephemeral: true })
    }
};