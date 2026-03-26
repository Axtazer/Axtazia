const {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle,
	MessageFlags,
} = require('discord.js');

const OWNER_ID = process.env.OWNER_ID;

// Global game state map: key = message.id, value = game state
const games = new Map();

// Winning combinations (indices in flat 3x3 board)
const WIN_COMBOS = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
];

/**
 * Build the 3 ActionRows of 3 buttons each from the board state.
 * @param {string[]} board - flat array of 9 cells: null | 'X' | 'O'
 * @param {number[]|null} winningCells - indices of winning cells (if any)
 * @param {boolean} ended - whether the game is over
 * @returns {ActionRowBuilder[]}
 */
function buildComponents(board, winningCells = null, ended = false) {
	const rows = [];
	for (let row = 0; row < 3; row++) {
		const actionRow = new ActionRowBuilder();
		for (let col = 0; col < 3; col++) {
			const index = row * 3 + col;
			const cell = board[index];
			const btn = new ButtonBuilder()
				.setCustomId(`morpion_${row}_${col}`)
				.setLabel(cell ? cell : '\u200b');

			if (ended) {
				btn.setDisabled(true);
				if (winningCells && winningCells.includes(index)) {
					btn.setStyle(ButtonStyle.Success);
				} else if (winningCells) {
					btn.setStyle(ButtonStyle.Danger);
				} else {
					// Draw
					btn.setStyle(ButtonStyle.Secondary);
				}
			} else {
				btn.setDisabled(cell !== null);
				btn.setStyle(ButtonStyle.Secondary);
			}

			actionRow.addComponents(btn);
		}
		rows.push(actionRow);
	}
	return rows;
}

/**
 * Check for a winner on the board.
 * @param {string[]} board
 * @returns {{ winner: string, cells: number[] }|null}
 */
function checkWinner(board) {
	for (const combo of WIN_COMBOS) {
		const [a, b, c] = combo;
		if (board[a] && board[a] === board[b] && board[a] === board[c]) {
			return { winner: board[a], cells: combo };
		}
	}
	return null;
}

/**
 * Build the game embed.
 * @param {object} game
 * @param {string|null} statusMessage - override status line
 * @returns {EmbedBuilder}
 */
function buildEmbed(game, statusMessage = null) {
	const [player1, player2] = game.players;
	const currentMention = game.currentPlayer === 'X' ? `<@${player1.id}>` : `<@${player2.id}>`;

	const description = statusMessage
		? statusMessage
		: `${currentMention} — c'est ton tour ! (**${game.currentPlayer}**)`;

	return new EmbedBuilder()
		.setColor(0x0032a0)
		.setTitle('Morpion')
		.setDescription(
			`<@${player1.id}> (**X**) affronte <@${player2.id}> (**O**)\n\n${description}`,
		);
}

/**
 * Handle a button interaction for the morpion game.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleMorpionButton(interaction) {
	const gameId = interaction.message.id;
	const game = games.get(gameId);

	if (!game) {
		return interaction.reply({
			content: 'Cette partie est introuvable ou a expiré.',
			flags: MessageFlags.Ephemeral,
		});
	}

	// Only the current player can press buttons
	const currentPlayerId =
		game.currentPlayer === 'X' ? game.players[0].id : game.players[1].id;

	if (interaction.user.id !== currentPlayerId) {
		return interaction.reply({
			content: "Ce n'est pas ton tour !",
			flags: MessageFlags.Ephemeral,
		});
	}

	// Parse row/col from customId: morpion_<row>_<col>
	const parts = interaction.customId.split('_');
	const row = parseInt(parts[1], 10);
	const col = parseInt(parts[2], 10);
	const index = row * 3 + col;

	if (game.board[index] !== null) {
		return interaction.reply({
			content: 'Cette case est déjà occupée !',
			flags: MessageFlags.Ephemeral,
		});
	}

	// Play the move
	game.board[index] = game.currentPlayer;

	// Check for winner
	const winResult = checkWinner(game.board);
	if (winResult) {
		const winnerId =
			winResult.winner === 'X' ? game.players[0].id : game.players[1].id;
		const components = buildComponents(game.board, winResult.cells, true);
		const embed = buildEmbed(
			game,
			`🎉 <@${winnerId}> (**${winResult.winner}**) a gagné la partie !`,
		);
		clearTimeout(game.timeout);
		games.delete(gameId);
		return interaction.update({ embeds: [embed], components });
	}

	// Check for draw
	const isDraw = game.board.every(cell => cell !== null);
	if (isDraw) {
		const components = buildComponents(game.board, null, true);
		const embed = buildEmbed(game, "C'est un match nul !");
		clearTimeout(game.timeout);
		games.delete(gameId);
		return interaction.update({ embeds: [embed], components });
	}

	// Switch player
	game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';

	// Reset inactivity timeout
	clearTimeout(game.timeout);
	game.timeout = setTimeout(async () => {
		if (games.has(gameId)) {
			games.delete(gameId);
			try {
				const disabledComponents = buildComponents(game.board, null, true);
				const embed = buildEmbed(
					game,
					'⏰ La partie a expiré par inactivité.',
				);
				await interaction.message.edit({
					embeds: [embed],
					components: disabledComponents,
				});
			} catch (err) {
				console.error('[Morpion] Erreur lors de l\'expiration de la partie:', err);
			}
		}
	}, 5 * 60 * 1000);

	const components = buildComponents(game.board, null, false);
	const embed = buildEmbed(game);
	return interaction.update({ embeds: [embed], components });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('morpion')
		.setDescription('Joue au morpion avec la personne de ton choix.')
		.addUserOption(option =>
			option
				.setName('target')
				.setDescription('Choisissez votre adversaire.')
				.setRequired(true),
		),

	/**
	 * @param {ChatInputCommandInteraction} interaction
	 */
	async execute(interaction) {
		const target = interaction.options.getUser('target');

		// Cannot challenge a bot
		if (target.bot) {
			return interaction.reply({
				content: 'Tu ne peux pas défier un bot au morpion !',
				flags: MessageFlags.Ephemeral,
			});
		}

		// Cannot challenge yourself
		if (target.id === interaction.user.id) {
			return interaction.reply({
				content: 'Tu ne peux pas jouer contre toi-même !',
				flags: MessageFlags.Ephemeral,
			});
		}

		const board = Array(9).fill(null);
		const players = [interaction.user, target];
		const currentPlayer = 'X';

		const gameState = {
			board,
			currentPlayer,
			players,
			messageId: null,
			timeout: null,
		};

		const embed = buildEmbed(gameState);
		const components = buildComponents(board, null, false);

		try {
			// Public reply so both players see the board
			const message = await interaction.reply({
				content: `${target} tu es défié au morpion par **${interaction.user.displayName}** !`,
				embeds: [embed],
				components,
				fetchReply: true,
			});

			gameState.messageId = message.id;

			// Set inactivity timeout
			gameState.timeout = setTimeout(async () => {
				if (games.has(message.id)) {
					games.delete(message.id);
					try {
						const disabledComponents = buildComponents(board, null, true);
						const expiredEmbed = buildEmbed(
							gameState,
							'⏰ La partie a expiré par inactivité.',
						);
						await message.edit({
							embeds: [expiredEmbed],
							components: disabledComponents,
						});
					} catch (err) {
						console.error('[Morpion] Erreur lors de l\'expiration de la partie:', err);
					}
				}
			}, 5 * 60 * 1000);

			games.set(message.id, gameState);
		} catch (error) {
			console.error('[Morpion] Erreur lors de la création de la partie:', error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'Une erreur est survenue lors de la création de la partie.',
					flags: MessageFlags.Ephemeral,
				});
			} else {
				await interaction.reply({
					content: 'Une erreur est survenue lors de la création de la partie.',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},

	handleMorpionButton,
	games,
};
