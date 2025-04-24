const {
    joinVoiceChannel,
    createAudioResource,
    AudioPlayerStatus,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const { initQueue } = require('../utils/musicQueue'); // Adjust path if needed

const pyPath = process.env.PyPath;
if (!pyPath) {
    console.error("❌ ERROR: PyPath is undefined.");
    // Don't use `return` here because you're outside a function
    process.exit(1);
}

module.exports = async function playYtdlp(msg) {
    const args = msg.content.trim().split(" ");
    const url = args[1];

    if (!url || !url.startsWith("http")) {
        return msg.reply("❗ Provide a valid YouTube URL.");
    }

    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) {
        return msg.reply("❗ You need to be in a voice channel to use this command.");
    }

    const guildId = msg.guild.id;
    const queue = initQueue(guildId);
    queue.songs.push({ url, requestedBy: msg.author.username });
    msg.reply(`🎶 Added to queue: ${url}`);

    // Only start playback if this is the first song
    if (queue.songs.length === 1) {
        startPlayback(msg, queue, voiceChannel);
    }
};

function startPlayback(msg, queue, voiceChannel) {
    const song = queue.songs[0];
    if (!song) {
        msg.channel.send("📭 Queue is empty.");
        return;
    }

    if (!queue.connection) {
        queue.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        queue.connection.subscribe(queue.player);
    }

    const ytdlp = spawn(pyPath, [
        '-m', 'yt_dlp',
        '-f', 'bestaudio',
        '-o', '-',
        '--quiet',
        '--no-warnings',
        song.url
    ]);

    const resource = createAudioResource(ytdlp.stdout);
    queue.player.play(resource);

    msg.channel.send(`🎵 Now playing: ${song.url} (requested by ${song.requestedBy})`);

    queue.player.once(AudioPlayerStatus.Idle, () => {
        queue.songs.shift(); // Remove finished song
        if (queue.songs.length > 0) {
            startPlayback(msg, queue, voiceChannel); // Play next
        } else {
            queue.connection.destroy();
            queue.connection = null;
        }
    });

    queue.player.on('error', (error) => {
        console.error("Playback error:", error);
        msg.channel.send("⚠️ Error during playback, skipping...");
        queue.songs.shift();
        if (queue.songs.length > 0) {
            startPlayback(msg, queue, voiceChannel);
        } else {
            queue.connection.destroy();
            queue.connection = null;
        }
    });
}
