const { Events, ActivityType } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
        console.log(`${client.user.tag} est en ligne !`);
        client.user.setActivity('les étoiles ✨', { type: ActivityType.Watching });
        client.user.setStatus('online');
	},
};