const { getQueue } = require('../utils/musicQueue');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = function skipSong(msg) {
    const guildId = msg.guild.id;
    const queue = getQueue(guildId);

    if (!queue || !queue.connection || !queue.player || queue.songs.length === 0) {
        return msg.reply("There's nothing to skip.");
    }

    if (queue.player.state.status === AudioPlayerStatus.Playing || queue.player.state.status === AudioPlayerStatus.Idle) {
        queue.intentionalStop = true;
        if (queue.currentProcess) {
            queue.currentProcess.kill();
            queue.currentProcess = null;
        }
        queue.player.stop();
        msg.reply("Skipping to the next song...");
    } else {
        msg.reply("No song is currently playing.");
    }
};
