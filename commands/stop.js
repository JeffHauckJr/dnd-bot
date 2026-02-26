const { getQueue, deleteQueue } = require('../utils/musicQueue');

module.exports = function stopMusic(msg) {
    const guildId = msg.guild.id;
    const queue = getQueue(guildId);

    if (!queue || !queue.connection || !queue.player) {
        return msg.reply("There's nothing to stop.");
    }

    queue.intentionalStop = true;
    if (queue.currentProcess) {
        queue.currentProcess.kill();
        queue.currentProcess = null;
    }
    queue.player.stop();
    queue.connection.destroy();
    deleteQueue(guildId);

    msg.reply("Music stopped and queue cleared.");
};
