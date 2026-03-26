const { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const ownerId = process.env.OWNER_ID;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Liste des commandes existantes.'),
    /**
     * @param {ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const client = interaction.client;
        const commandsData = {};

        // Dossier commands
        const commandsPath = path.resolve(__dirname, '../../commands');

        // Lectures des fichiers commands de manière récursive
        const readCommands = (dir, category) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                    readCommands(filePath, file); // Prise du nom de sous dossier comme catégorie
                } else if (file.endsWith('.js')) {
                    const command = require(filePath);
                    if (command.data && typeof command.data.name === 'string' && typeof command.data.description === 'string') {
                        if (!commandsData[category]) {
                            commandsData[category] = [];
                        }
                        commandsData[category].push({
                            name: command.data.name,
                            description: command.data.description
                        });
                    }
                }
            }
        };

        try {
            // Lecture de tous les fichiers de commandes
            readCommands(commandsPath, 'General');

            const owner = await client.users.fetch(ownerId);
            const bot = client.user;

            // Ordre custom et noms
            const categoryOrder = [
                { originalName: 'utility', displayName: `🤖 Moi, ${bot.displayName}` },
                { originalName: 'interactions', displayName: '👯 Fun' },
                // { originalName: 'games', displayName: '🕹️ Jeux' },
                // { originalName: 'ticketSystem', displayName: '🎟️ Tickets' }
            ];

            // Création de l'embed
            const listEmbed = new EmbedBuilder()
                .setColor(0x0032A0)
                .setTitle("Liste des commandes")
                .setDescription("Voici la liste des commandes et leurs descriptions.");

            // Add fields to the embed for each category in custom order
            for (const category of categoryOrder) {
                const commands = commandsData[category.originalName];
                if (commands) {
                    listEmbed.addFields({ name: category.displayName, value: commands.map(cmd => `**/${cmd.name}** - ${cmd.description}`).join('\n'), inline: false });
                }
            }

            listEmbed.setAuthor({ name: bot.displayName, iconURL: bot.avatarURL(), url: 'https://axtazer.online' });
            listEmbed.setFooter({ text: `${bot.username} par ${owner.username} avec le 🫀`, iconURL: owner.avatarURL() });

            await interaction.reply({ embeds: [listEmbed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors du chargement des commandes. Veuillez réessayer plus tard.', flags: MessageFlags.Ephemeral });
        }
    },
};