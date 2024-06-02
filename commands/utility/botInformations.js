const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } = require('discord.js');
const { ownerId, clientId } = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Donne les informations du bot.'),
            /**
             * @param {ChatInputCommandInteraction} interaction
             */
        async execute(interaction) {
            const client = interaction.client;
            const owner = await client.users.fetch(ownerId);
            const bot = await client.users.fetch(clientId);

            const botInfo = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(bot.displayName)
//            .setAuthor({ name: owner.displayName, iconURL: owner.avatarURL(), url: 'https://axtazer.online' })
            .setDescription(`Une application par ${owner}.`)
            .setThumbnail(bot.avatarURL())
            .addFields(
                { name: 'En ligne depuis', value: `${
                    Math.floor((client.uptime/(1000*60*60*24))%60).toString()}j ${
                    Math.floor((client.uptime/(1000*60*60))%60).toString()}h ${
                    Math.floor((client.uptime/(1000*60))%60).toString()}m ${
                    Math.floor((client.uptime/1000)%60).toString()}s` },
                { name: 'Langue', value: '🇫🇷 Français', inline: true },
                { name: 'Utilitée', value: '🛠️ Apprentissage personnel', inline: false },
                { name: 'Objectif', value: '🫰 Être utile et plaire', inline: false }
            )
            //.addFields({ name: 'Inline field title', value: 'Some value here', inline: true })
            //.setImage('https://i.imgur.com/AfFp7pu.png')
            .setFooter({ text: `${bot.displayName} par ${owner.displayName} avec le 🫀`, iconURL: owner.avatarURL() });
            await interaction.reply({ embeds: [botInfo], ephemeral: false})
    }
};