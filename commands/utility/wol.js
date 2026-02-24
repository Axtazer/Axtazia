const { SlashCommandBuilder, MessageFlags } = require('discord.js');
require('dotenv').config();
ownerId = process.env.OWNER_ID;
API_URL = process.env.WOL_API_URL;
API_TOKEN = process.env.WOL_API_TOKEN;

// Messages d'erreur centralisés
const ERRORS = {
  CONFIG: '❌ Configuration WoL manquante (API_URL ou API_TOKEN).',
  UNAUTHORIZED: "❌ Tu n'as pas l'autorisation d'utiliser cette commande.",
  HTTP_ERROR: (status) => `❌ Échec de la requête WoL (code HTTP ${status}).`,
  API_ERROR: (data) => `⚠️ Requête envoyée, mais la réponse API indique une erreur.\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
  NETWORK: (err) => `❌ Impossible de contacter l'API WoL.\n\`${String(err)}\``
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wake')
    .setDescription('Réveille le PC via Wake-on-LAN'),
  
  async execute(interaction) {
    // Vérifications préliminaires
    if (!API_URL || !API_TOKEN) {
      return interaction.reply({
        content: ERRORS.CONFIG,
        flags: MessageFlags.Ephemeral,
      });
    }
    
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: ERRORS.UNAUTHORIZED,
        flags: MessageFlags.Ephemeral
      });
    }
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      const url = new URL(API_URL);
      url.searchParams.set('token', API_TOKEN);
      
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error('WoL API error:', res.status, bodyText);
        return interaction.editReply(ERRORS.HTTP_ERROR(res.status));
      }
      
      const data = await res.json().catch(() => ({}));
      
      // Réponse basée sur le résultat
      return interaction.editReply(
        data.success === true 
          ? '✅ Magic packet envoyé !' 
          : ERRORS.API_ERROR(data)
      );
      
    } catch (err) {
      console.error('Erreur WoL:', err);
      return interaction.editReply(ERRORS.NETWORK(err));
    }
  },
};