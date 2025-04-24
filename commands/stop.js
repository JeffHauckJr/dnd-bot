const { getQueue, deleteQueue } = require('../utils/musicQueue');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = function stopMusic(msg) {
    const guildId = msg.guild.id;
    const queue = getQueue(guildId);

    if (!queue || !queue.connection || !queue.player) {
        return msg.reply("❗ I'm not currently playing music.");
    }

    console.log("Current player status:", queue.player.state.status);

    if (queue.player.state.status === AudioPlayerStatus.Playing || queue.player.state.status === AudioPlayerStatus.Idle) {
        queue.player.stop();  // Stop playback
        queue.connection.destroy();  // Disconnect from voice
        deleteQueue(guildId);  // Clean up state
        msg.reply("🛑 Music stopped and disconnected.");
    } else {
        msg.reply("❗ No music is currently playing.");
    }
};
