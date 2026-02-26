const {
    joinVoiceChannel,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType,
} = require('@discordjs/voice');
const { spawn, execFile } = require('child_process');
const { initQueue } = require('../utils/musicQueue');

const YTDLP_PATH = 'yt-dlp';
const FFMPEG_PATH = require('ffmpeg-static');
const YTDLP_COMMON = ['--js-runtimes', 'node', '--no-warnings', '--no-playlist'];

module.exports = async function playYtdlp(msg) {
    const args = msg.content.trim().split(" ");
    const url = args[1];

    if (!url || !url.startsWith("http")) {
        return msg.reply("Provide a valid YouTube URL.");
    }

    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) {
        return msg.reply("You need to be in a voice channel to use this command.");
    }

    const guildId = msg.guild.id;
    const queue = initQueue(guildId);

    // Reply immediately so the user knows the bot is working
    msg.reply(`Loading song...`);

    // Get title + stream URL in one yt-dlp call
    let title = url;
    let streamUrl;
    try {
        const info = await getSongInfo(url);
        title = info.title || url;
        streamUrl = info.streamUrl;
    } catch (e) {
        console.error('[yt-dlp] Info fetch error:', e.message);
        return msg.channel.send(`Failed to load: ${e.message}`);
    }

    queue.songs.push({ url, title, streamUrl, requestedBy: msg.author.username });
    msg.channel.send(`Added to queue: **${title}** (requested by ${msg.author.username})`);

    if (queue.songs.length === 1) {
        startPlayback(msg, queue, voiceChannel);
    }
};

function getSongInfo(url) {
    return new Promise((resolve, reject) => {
        // Single call: get title + stream URL at once
        // Use flexible format: prefer audio, fall back to best available
        const proc = spawn(YTDLP_PATH, [
            '-f', 'bestaudio[ext=m4a]/bestaudio/best',
            '--print', '%(title)s',
            '--print', '%(url)s',
            ...YTDLP_COMMON,
            url,
        ]);
        let output = '';
        let errorOutput = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
        proc.on('close', (code) => {
            if (code === 0 && output.trim()) {
                const lines = output.trim().split('\n');
                // Line 0 = title, Line 1 = stream URL
                const title = lines[0]?.trim() || url;
                const streamUrl = lines[1]?.trim();
                if (!streamUrl || !streamUrl.startsWith('http')) {
                    reject(new Error('Failed to get stream URL'));
                    return;
                }
                resolve({ streamUrl, title });
            } else {
                reject(new Error(`yt-dlp failed (code ${code}): ${errorOutput.slice(-200)}`));
            }
        });
        proc.on('error', reject);
    });
}

async function startPlayback(msg, queue, voiceChannel) {
    const song = queue.songs[0];
    if (!song) {
        msg.channel.send("Queue is empty.");
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

        queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(queue.connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(queue.connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                console.error('[Voice] Failed to reconnect:', error.message);
                msg.channel.send("Voice connection lost and couldn't reconnect.");
                queue.connection.destroy();
                queue.connection = null;
                queue.songs = [];
            }
        });

        queue.connection.on('error', (error) => {
            console.error('[Voice] Connection error:', error);
        });
    }

    // Remove previous listeners to prevent accumulation
    queue.player.removeAllListeners(AudioPlayerStatus.Idle);
    queue.player.removeAllListeners('error');
    queue.player.removeAllListeners('stateChange');
    queue.intentionalStop = false;

    try {
        // If we don't have a stream URL yet (e.g. queued before change), fetch it
        if (!song.streamUrl) {
            console.log(`[yt-dlp] Getting stream URL for: ${song.url}`);
            const info = await getSongInfo(song.url);
            song.streamUrl = info.streamUrl;
        }
        console.log(`[yt-dlp] Piping HLS stream through ffmpeg`);
        const streamUrl = song.streamUrl;

        // Step 2: Pipe the HLS stream through ffmpeg to get raw audio
        const ffmpeg = spawn(FFMPEG_PATH, [
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-i', streamUrl,
            '-vn',              // no video
            '-acodec', 'libopus',
            '-f', 'opus',       // output opus
            '-ar', '48000',     // 48kHz (Discord standard)
            '-ac', '2',         // stereo
            '-b:a', '128k',
            'pipe:1',           // output to stdout
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        queue.currentProcess = ffmpeg;

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString().trim();
            // Only log errors, not the usual ffmpeg progress
            if (line.includes('Error') || line.includes('error') || line.includes('Invalid')) {
                console.error(`[ffmpeg]`, line);
            }
        });

        ffmpeg.on('error', (err) => {
            console.error('[ffmpeg] Process error:', err.message);
        });

        const resource = createAudioResource(ffmpeg.stdout, {
            inputType: StreamType.OggOpus,
        });

        queue.player.play(resource);
        msg.channel.send(`Now playing: **${song.title}** (requested by ${song.requestedBy})`);
    } catch (error) {
        console.error(`[yt-dlp] Stream error for "${song.url}":`, error);
        msg.channel.send(`Failed to play: ${error.message}. Skipping...`);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            startPlayback(msg, queue, voiceChannel);
        } else if (queue.connection) {
            queue.connection.destroy();
            queue.connection = null;
        }
        return;
    }

    queue.player.once(AudioPlayerStatus.Idle, () => {
        queue.currentProcess = null;
        queue.songs.shift();
        if (queue.songs.length > 0) {
            startPlayback(msg, queue, voiceChannel);
        } else if (queue.connection) {
            queue.connection.destroy();
            queue.connection = null;
        }
    });

    queue.player.on('error', (error) => {
        console.error('[Player] Playback error:', error);
        msg.channel.send(`Playback error: ${error.message}. Skipping...`);
        if (queue.currentProcess) {
            queue.currentProcess.kill();
            queue.currentProcess = null;
        }
        queue.songs.shift();
        if (queue.songs.length > 0) {
            startPlayback(msg, queue, voiceChannel);
        } else if (queue.connection) {
            queue.connection.destroy();
            queue.connection = null;
        }
    });
}
