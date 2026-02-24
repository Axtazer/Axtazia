const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } = require('discord.js');
require ('dotenv').config();
ownerId = process.env.OWNER_ID;
clientId = process.env.CLIENT_ID;

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
            const image = 'https://cdn.discordapp.com/attachments/1018273550160908309/1018276033721532446/pikahello.gif?ex=665ee235&is=665d90b5&hm=26c08e2a9c34be7b000887b31999facc112040135da835665e06cd5dcf721bff&';

            const botInfo = new EmbedBuilder()
            .setColor(0xe67e22)
            // .setTitle(bot.displayName)
            .setAuthor({ name: bot.displayName, iconURL: bot.avatarURL(), url: 'https://axtazer.online' })
            .setDescription(`Une application par ${owner}.`)
            .setThumbnail(bot.avatarURL())
            .addFields(
                { name: 'En ligne depuis', value: `🟢 ${
                    Math.floor((client.uptime/(1000*60*60*24))%60).toString()}j ${
                    Math.floor((client.uptime/(1000*60*60))%60).toString()}h ${
                    Math.floor((client.uptime/(1000*60))%60).toString()}m ${
                    Math.floor((client.uptime/1000)%60).toString()}s`, inline: false },
                { name: 'Ping', value: `🏓 ${Math.round(client.ws.ping)}ms`, inline: false },
                { name: 'Langue', value: '🇫🇷 Français', inline: false },
                { name: 'Utilitée', value: '🛠️ Apprentissage personnel', inline: false },
                { name: 'Objectif', value: '🫰 Être utile et plaire', inline: false }
            )
            .setImage(image)
            .setFooter({ text: `${bot.displayName} par ${owner.displayName} avec le 🫀`, iconURL: owner.avatarURL() });
            await interaction.reply({ embeds: [botInfo], ephemeral: false})
    }
};