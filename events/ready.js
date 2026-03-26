const { Events, ActivityType } = require('discord.js');
const { startWebhookServer } = require('../src/twitch/webhookServer');
const { subscribeToStreamOnline } = require('../src/twitch/subscriptions');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
        console.log(`${client.user.tag} est en ligne !`);
        client.user.setActivity('les étoiles ✨', { type: ActivityType.Watching });
        client.user.setStatus('online');

        // Démarrage du serveur webhook Twitch EventSub
        startWebhookServer(client);

        // Abonnement à l'événement stream.online (ne bloque pas le démarrage)
        subscribeToStreamOnline(process.env.TWITCH_BROADCASTER_ID).catch(err => {
            console.error('[Twitch] Erreur non gérée lors de l\'abonnement EventSub:', err);
        });
	},
};
