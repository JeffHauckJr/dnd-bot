const { getQueue } = require('../utils/musicQueue');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = function skipSong(msg) {
    const guildId = msg.guild.id;
    const queue = getQueue(guildId);

    if (!queue || !queue.connection || !queue.player || queue.songs.length === 0) {
        return msg.reply("❗ There's nothing to skip.");
    }

    if (queue.player.state.status === AudioPlayerStatus.Playing || queue.player.state.status === AudioPlayerStatus.Idle) {
        queue.player.stop(); // This will trigger AudioPlayerStatus.Idle and move to the next track
        msg.reply("⏭️ Skipping to the next song...");
    } else {
        msg.reply("❗ No song is currently playing.");
    }
};
