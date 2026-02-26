const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const csv = require('fast-csv');

module.exports = async (message) => {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
        return message.channel.send('I am not recording in this server!');
    }

    connection.destroy();
    message.client.voiceConnections.delete(message.guild.id);
    message.channel.send('Stopped recording. Now transcribing...');

    const guildDir = `./recordings/${message.guild.id}`;
    if (!fs.existsSync(guildDir)) {
        return message.channel.send('No recordings found for this server.');
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const transcriptions = [];
    const files = fs.readdirSync(guildDir);

    for (const file of files) {
        if (file.endsWith('.pcm')) {
            const pcmPath = `${guildDir}/${file}`;
            const mp3Path = `${guildDir}/${file.replace('.pcm', '.mp3')}`;
            const userId = file.replace('.pcm', '');
            const user = await message.client.users.fetch(userId);
            const username = user ? user.username : 'Unknown User';

            await new Promise((resolve, reject) => {
                ffmpeg(pcmPath)
                    .inputFormat('s16le')
                    .audioChannels(2)
                    .audioFrequency(48000)
                    .toFormat('mp3')
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .save(mp3Path);
            });

            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(mp3Path),
                model: 'whisper-1',
            });

            transcriptions.push({
                timestamp: new Date().toISOString(),
                user: username,
                text: transcription.text,
            });

            fs.unlinkSync(pcmPath);
            fs.unlinkSync(mp3Path);
        }
    }

    if (transcriptions.length > 0) {
        const csvPath = `${guildDir}/transcript.csv`;
        const csvStream = csv.format({ headers: true });
        const writeStream = fs.createWriteStream(csvPath);

        csvStream.pipe(writeStream).on('end', () => {
            message.channel.send({ content: 'Here is the transcript:', files: [csvPath] })
                .then(() => {
                    fs.unlinkSync(csvPath);
                    fs.rmdirSync(guildDir, { recursive: true });
                });
        });

        transcriptions.forEach(t => csvStream.write(t));
        csvStream.end();
    } else {
        message.channel.send('No speech was detected during the recording.');
        fs.rmdirSync(guildDir, { recursive: true });
    }
};