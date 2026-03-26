const { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } = require('discord.js');
const ownerId = process.env.OWNER_ID;

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
            const bot = client.user;
            const readyTimestamp = Math.floor((Date.now() - client.uptime) / 1000);

            const botInfo = new EmbedBuilder()
            .setColor(0xe67e22)
            .setAuthor({ name: bot.displayName, iconURL: bot.avatarURL(), url: 'https://axtazer.online' })
            .setDescription(`Une application par ${owner}.`)
            .setThumbnail(bot.avatarURL())
            .addFields(
                { name: 'En ligne depuis', value: `🟢 <t:${readyTimestamp}:R>`, inline: false },
                { name: 'Ping', value: `🏓 ${Math.round(client.ws.ping)}ms`, inline: false },
                { name: 'Langue', value: '🇫🇷 Français', inline: false },
                { name: 'Utilitée', value: '🛠️ Apprentissage personnel', inline: false },
                { name: 'Objectif', value: '🫰 Être utile et plaire', inline: false }
            )
            .setFooter({ text: `${bot.displayName} par ${owner.displayName} avec le 🫀`, iconURL: owner.avatarURL() });
            await interaction.reply({ embeds: [botInfo] })
    }
};