const { Events, MessageFlags } = require('discord.js');
const { handleMorpionButton } = require('../commands/games/morpion');

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
				} else {
					await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
				}
			}
		} else if (interaction.isButton()) {
			if (interaction.customId.startsWith('morpion_')) {
				try {
					await handleMorpionButton(interaction);
				} catch (error) {
					console.error('[Morpion] Erreur lors du traitement du bouton:', error);
					if (interaction.replied || interaction.deferred) {
						await interaction.followUp({
							content: 'Une erreur est survenue lors du traitement de cette action.',
							flags: MessageFlags.Ephemeral,
						});
					} else {
						await interaction.reply({
							content: 'Une erreur est survenue lors du traitement de cette action.',
							flags: MessageFlags.Ephemeral,
						});
					}
				}
			}
		}
	},
};
