const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } = require('discord.js');
const { ownerId, clientId } = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('morpion')
        .setDescription('!! EN CONSTRUCTION !! Joue au morpion avec la personne de ton choix.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription("Choisissez votre adversaire.")
                .setRequired(true)),
    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const cible = interaction.options.getUser('target');
        const client = interaction.client;

        try {
            const owner = await client.users.fetch(ownerId);
            const bot = await client.users.fetch(clientId);

            // Création de l'embed
            const morpion = new EmbedBuilder()  
                .setColor(0x0032A0)
                .setTitle("Morpion")
                //.setAuthor({ name: "NASA - APOD", iconURL: nasaAuthor, url: 'https://apod.nasa.gov/' })
                .setDescription(`${interaction.user} défie ${cible} au **morpion** !`)
                .addFields(
                    { name: `X | X | X`, value: '**- | - | -**', inline: false },
                    // { name: `- | - | -`, value: ' ', inline: false },
                    { name: `X | X | X`, value: '**- | - | -**', inline: false },
                    // { name: `- | - | -`, value: ' ', inline: false },
                    { name: `X | X | X`, value: ' ', inline: false }

                )
                .setFooter({ text: `${bot.username} par ${owner.username} avec le 🫀`, iconURL: owner.avatarURL() });

            await interaction.reply({ content: `${cible} tu es défié au morpion par **${interaction.user.displayName}** !`, embeds: [morpion], ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: `${error}`, ephemeral: true });
        }
    },
};