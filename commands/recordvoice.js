const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
// --- FIX ---
// Import OpusDecoder directly from 'prism-media'
const { OpusDecoder } = require('prism-media');
// --- END FIX ---

// --- CHECK MOVED ---
// We will check for OpusDecoder *inside* the function.
// --- END CHECK ---

module.exports = async (message) => {
    // --- ADDED CHECK ---
    // Check if the import failed. This usually means native dependencies are missing.
    // We run this check when the command is *used*, not when the file is loaded.
    if (!OpusDecoder) {
        console.error('OpusDecoder not found. This usually means @discordjs/opus or opusscript is not installed.');
        return message.channel.send(
            '**Voice Error:** Could not load audio dependencies.\n' +
            'Please have the bot owner run: `npm install @discordjs/opus opusscript`'
        );
    }
    // --- END CHECK ---

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.channel.send('You need to be in a voice channel to record audio!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    // A Map to store voice connections is a good practice.
    // Ensure this is initialized on your client object, e.g., client.voiceConnections = new Map();
    if (!message.client.voiceConnections) {
        message.client.voiceConnections = new Map();
    }

    if (message.client.voiceConnections.has(message.guild.id)) {
        return message.channel.send('I am already recording in this server!');
    }

    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });

        message.client.voiceConnections.set(message.guild.id, connection);
        message.channel.send('Started recording!');

        const recordingsDir = './recordings';
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir);
        }
        const guildDir = `${recordingsDir}/${message.guild.id}`;
        if (!fs.existsSync(guildDir)) {
        fs.mkdirSync(guildDir);
    }

    // This line causes the error if @discordjs/opus is not installed.
    // Make sure you have run: npm install @discordjs/opus opusscript
    // --- FIX ---
    // Use the imported OpusDecoder class directly
    const decoder = new OpusDecoder({ rate: 48000, channels: 2, frameSize: 960 });
    // --- END FIX ---

    connection.receiver.speaking.on('start', (userId) => {
            if (userId !== message.client.user.id) {
                const opusStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 100,
                    },
                });

                const pcmFilePath = `${guildDir}/${userId}.pcm`;
                const pcmStream = fs.createWriteStream(pcmFilePath);

                // --- FIX ---
                // The decoder is a Transform Stream. You should pipe data through it.
                // Do not use opusStream.on('data', ...) and decoder.decode()
                // The correct way is to pipe:
                // OpusStream (from Discord) -> Opus.Decoder (to PCM) -> Fs.WriteStream (to file)
                opusStream.pipe(decoder).pipe(pcmStream);
                // --- END FIX ---

                opusStream.on('end', () => {
                    console.log(`Finished writing ${pcmFilePath}`);
                    // pcmStream will be closed automatically when the piped streams end.
                });

                opusStream.on('error', (err) => {
                    console.error(`Error with opus stream for ${userId}:`, err);
                    pcmStream.close(); // Ensure file stream is closed on error
                });
            }
        });

    } catch (err) {
        console.log(err);
        if (message.client.voiceConnections.has(message.guild.id)) {
            message.client.voiceConnections.get(message.guild.id).destroy();
            message.client.voiceConnections.delete(message.guild.id);
        }
        return message.channel.send(err.message);
    }
};



