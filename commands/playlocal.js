const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

module.exports = async function playLocal(msg) {
    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) {
        return msg.reply("❗ You need to join a voice channel first.");
    }

    // Connect to the user's voice channel
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    // Path to your local MP3 file in the root folder
    const filePath = path.join(__dirname, '../test.mp3');
    const resource = createAudioResource(fs.createReadStream(filePath));

    // Play the local audio
    player.play(resource);

    msg.reply("🎶 Playing local test.mp3");

    player.on(AudioPlayerStatus.Playing, () => {
        console.log("✅ Local MP3 is playing");
    });

    player.on(AudioPlayerStatus.Idle, () => {
        console.log("🛑 Local playback finished");
        connection.destroy();
    });

    player.on('error', (err) => {
        console.error("Audio Player Error:", err);
        msg.channel.send("⚠️ Error occurred while playing local file.");
    });
};
