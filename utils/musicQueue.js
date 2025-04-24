const { createAudioPlayer } = require('@discordjs/voice');

const queue = new Map(); // key = guildId

function initQueue(guildId) {
    if (!queue.has(guildId)) {
        queue.set(guildId, {
            connection: null,
            player: createAudioPlayer(),
            songs: [],
        });
    }
    return queue.get(guildId);
}

function getQueue(guildId) {
    return queue.get(guildId);
}

function deleteQueue(guildId) {
    queue.delete(guildId);
}

module.exports = { queue, initQueue, getQueue, deleteQueue };
