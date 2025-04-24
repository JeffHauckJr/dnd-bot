const { getQueue } = require('../utils/musicQueue'); // Adjust path if needed

module.exports = function showQueue(msg) {
    const guildId = msg.guild.id;
    const queue = getQueue(guildId);

    if (!queue || queue.songs.length === 0) {
        return msg.reply("📭 The queue is empty!");
    }

    const nowPlaying = queue.songs[0];
    const upcoming = queue.songs.slice(1);

    let response = `🎵 **Now Playing:** ${nowPlaying.url} (requested by ${nowPlaying.requestedBy})\n`;

    if (upcoming.length > 0) {
        response += `\n📃 **Up Next:**\n`;
        upcoming.forEach((song, index) => {
            response += `${index + 1}. ${song.url} (requested by ${song.requestedBy})\n`;
        });
    }

    msg.channel.send(response);
};
