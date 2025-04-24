require('dotenv').config();
const play = require('play-dl');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} = require('@discordjs/voice');
const { initQueue } = require('../utils/musicQueue');

module.exports = async function playEncounter(msg) {
    // ✅ Set the YouTube cookie inside the function to avoid top-level await
    await play.setToken({
        youtube: {
            cookie: process.env.YOUTUBE_COOKIE
        }
    });

    const args = msg.content.trim().split(" ");
    const url = args[1];

    if (!url || !play.yt_validate(url)) {
        return msg.reply("❗ Please provide a valid YouTube URL like:\n`~playencounter https://www.youtube.com/watch?v=...`");
    }

    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) {
        return msg.reply("❗ You need to be in a voice channel to use this command.");
    }

    const queue = initQueue(msg.guild.id);

    try {
        if (!queue.connection) {
            console.log("🔌 Joining voice channel...");
            queue.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            queue.player = createAudioPlayer();
            queue.connection.subscribe(queue.player);
        }

        console.log("🔗 Streaming audio from YouTube...");
        const { stream, type } = await play.stream(url);
        console.log(`🎧 Stream type: ${type}`);

        const resource = createAudioResource(stream, { inputType: type });
        queue.player.play(resource);
        console.log("🎬 Sent resource to player");
        console.log("🧪 Resource details:", resource.metadata || "No metadata");


        msg.reply(`🎶 Now playing: ${url}`);

        queue.player.on(AudioPlayerStatus.Playing, () => {
            console.log("✅ Music is playing");
        });

        queue.player.on(AudioPlayerStatus.Idle, () => {
            console.log("🛑 Playback finished. Disconnecting.");
            queue.connection.destroy();
        });

        queue.player.on('error', (err) => {
            console.error("Audio Player Error:", err);
            msg.channel.send("⚠️ Error occurred during playback.");
        });

    } catch (err) {
        console.error("Voice connection error:", err.stack || err);
        msg.channel.send("⚠️ Could not join voice channel or play music.");
    }
};
