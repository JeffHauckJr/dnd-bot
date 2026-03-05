const {
    joinVoiceChannel,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const { initQueue } = require('../utils/musicQueue');

const YTDLP_PATH = 'yt-dlp';
const FFMPEG_PATH = require('ffmpeg-static');

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

    // Get title first
    msg.reply(`Loading song...`);

    let title = url;
    try {
        title = await getTitle(url);
    } catch (e) {
        console.error('[yt-dlp] Title fetch error:', e.message);
    }

    queue.songs.push({ url, title, requestedBy: msg.author.username });
    msg.channel.send(`Added to queue: **${title}** (requested by ${msg.author.username})`);

    if (queue.songs.length === 1) {
        startPlayback(msg, queue, voiceChannel);
    }
};

function getTitle(url) {
    return new Promise((resolve, reject) => {
        const proc = spawn(YTDLP_PATH, [
            '--print', '%(title)s',
            '--no-warnings',
            '--no-playlist',
            url,
        ]);
        let output = '';
        let errorOutput = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.stderr.on('data', (data) => { errorOutput += data.toString(); });
        proc.on('close', (code) => {
            if (code === 0 && output.trim()) {
                resolve(output.trim().split('\n')[0]);
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
    queue.intentionalStop = false;

    try {
        console.log(`[yt-dlp] Starting stream for: ${song.url}`);

        // Pipe yt-dlp directly to ffmpeg to avoid URL expiration issues
        // Use explicit POT provider config and verbose output for debugging
        const ytdlp = spawn(YTDLP_PATH, [
            '-f', 'ba/b',  // best audio, fallback to best anything
            '-o', '-',
            '--no-warnings',
            '--no-playlist',
            '--extractor-args', 'youtube:getpot_bgutil_baseurl=http://127.0.0.1:4416',
            '-v',  // verbose for debugging
            song.url,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        const ffmpeg = spawn(FFMPEG_PATH, [
            '-i', 'pipe:0',
            '-vn',
            '-acodec', 'libopus',
            '-f', 'opus',
            '-ar', '48000',
            '-ac', '2',
            '-b:a', '128k',
            'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        // Pipe yt-dlp stdout to ffmpeg stdin
        ytdlp.stdout.pipe(ffmpeg.stdin);

        // Track data flow for debugging
        let ytdlpBytes = 0;
        let ffmpegOutBytes = 0;

        ytdlp.stdout.on('data', (chunk) => {
            ytdlpBytes += chunk.length;
            if (ytdlpBytes % (100 * 1024) < chunk.length) {
                console.log(`[yt-dlp] Downloaded: ${Math.round(ytdlpBytes / 1024)} KB`);
            }
        });

        ffmpeg.stdout.on('data', (chunk) => {
            ffmpegOutBytes += chunk.length;
            if (ffmpegOutBytes % (100 * 1024) < chunk.length) {
                console.log(`[ffmpeg] Output: ${Math.round(ffmpegOutBytes / 1024)} KB`);
            }
        });

        ytdlp.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (line) {
                console.log(`[yt-dlp] ${line}`);
            }
        });

        ytdlp.on('error', (err) => {
            console.error('[yt-dlp] Process error:', err.message);
        });

        ytdlp.on('close', (code) => {
            console.log(`[yt-dlp] Process exited with code ${code}, downloaded ${Math.round(ytdlpBytes / 1024)} KB`);
            if (code !== 0 && ytdlpBytes === 0) {
                console.error('[yt-dlp] Download failed - no data received');
            }
        });

        // Timeout for stalled downloads (30 seconds without data)
        let lastDataTime = Date.now();
        const stallCheckInterval = setInterval(() => {
            const elapsed = Date.now() - lastDataTime;
            if (elapsed > 30000 && ytdlpBytes === 0) {
                console.error('[yt-dlp] Download stalled - no data for 30s, killing process');
                clearInterval(stallCheckInterval);
                ytdlp.kill();
                ffmpeg.kill();
            }
        }, 5000);

        ytdlp.stdout.on('data', () => { lastDataTime = Date.now(); });
        ytdlp.on('close', () => clearInterval(stallCheckInterval));

        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (line.includes('Error') || line.includes('error') || line.includes('Invalid')) {
                console.error(`[ffmpeg] ${line}`);
            }
        });

        ffmpeg.on('error', (err) => {
            console.error('[ffmpeg] Process error:', err.message);
        });

        queue.currentProcess = { ytdlp, ffmpeg };

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
        if (queue.currentProcess) {
            queue.currentProcess.ytdlp?.kill();
            queue.currentProcess.ffmpeg?.kill();
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

    queue.player.on('error', (error) => {
        console.error('[Player] Playback error:', error);
        msg.channel.send(`Playback error: ${error.message}. Skipping...`);
        if (queue.currentProcess) {
            queue.currentProcess.ytdlp?.kill();
            queue.currentProcess.ffmpeg?.kill();
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
