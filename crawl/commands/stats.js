const { getCharacter } = require('../../utils/persistence');
const { createCharacterSheetEmbed } = require('../ui/embeds');

/**
 * Handle the ~crawl stats command
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleStats(msg, args) {
    const guildId = msg.guild.id;

    // Check if viewing another user's stats
    let targetUser = msg.author;
    if (msg.mentions.users.size > 0) {
        targetUser = msg.mentions.users.first();
    }

    const character = await getCharacter(guildId, targetUser.id);

    if (!character) {
        if (targetUser.id === msg.author.id) {
            return msg.reply('You don\'t have a character yet! Use `~crawl create` to make one.');
        } else {
            return msg.reply(`${targetUser.username} doesn't have a character yet.`);
        }
    }

    const embed = createCharacterSheetEmbed(character);
    await msg.reply({ embeds: [embed] });
}

module.exports = { handleStats };
