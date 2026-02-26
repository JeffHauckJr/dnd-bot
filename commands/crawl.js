const { handleCreate } = require('../crawl/commands/create');
const { handleStats } = require('../crawl/commands/stats');
const { handleHelp } = require('../crawl/commands/help');
const { handleStart } = require('../crawl/commands/start');
const { handleInventory } = require('../crawl/commands/inventory');
const { handleLevelUp } = require('../crawl/commands/levelup');
const { handleParty } = require('../crawl/commands/party');
const { handleRest } = require('../crawl/commands/rest');
const { handleShop } = require('../crawl/commands/shop');
const { handleAbilities } = require('../crawl/commands/abilities');

/**
 * Main router for ~crawl commands
 * @param {Message} msg
 */
module.exports = async (msg) => {
    const args = msg.content.split(' ').slice(1); // Remove "~crawl"
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
        case 'create':
            return handleCreate(msg, args.slice(1));

        case 'stats':
        case 'stat':
        case 'character':
        case 'char':
            return handleStats(msg, args.slice(1));

        case 'start':
        case 'begin':
        case 'dungeon':
            return handleStart(msg, args.slice(1));

        case 'inventory':
        case 'inv':
        case 'items':
            return handleInventory(msg, args.slice(1));

        case 'levelup':
        case 'lvlup':
        case 'lvl':
            return handleLevelUp(msg, args.slice(1));

        case 'abilities':
        case 'ability':
        case 'skills':
        case 'spells':
            return handleAbilities(msg, args.slice(1));

        case 'party':
            return handleParty(msg, args.slice(1));

        case 'rest':
        case 'sleep':
        case 'heal':
            return handleRest(msg, args.slice(1));

        case 'shop':
        case 'store':
        case 'market':
        case 'buy':
        case 'sell':
            return handleShop(msg, args.slice(1));

        case 'delete':
            return handleDelete(msg, args.slice(1));

        case 'leaderboard':
        case 'lb':
        case 'top':
            // TODO: Implement
            return msg.reply('Leaderboard coming soon!');

        case 'help':
        case undefined:
        case '':
            return handleHelp(msg, args.slice(1));

        default:
            return msg.reply(`Unknown subcommand: \`${subcommand}\`. Use \`~crawl help\` for a list of commands.`);
    }
};

/**
 * Handle character deletion
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleDelete(msg, args) {
    const { getCharacter, deleteCharacter } = require('../utils/persistence');
    const guildId = msg.guild.id;
    const odiscordUserId = msg.author.id;

    const character = await getCharacter(guildId, odiscordUserId);
    if (!character) {
        return msg.reply('You don\'t have a character to delete!');
    }

    // Require confirmation
    if (args[0]?.toLowerCase() !== 'confirm') {
        return msg.reply(`Are you sure you want to delete **${character.name}**? This cannot be undone!\n\nType \`~crawl delete confirm\` to permanently delete your character.`);
    }

    await deleteCharacter(guildId, odiscordUserId);
    return msg.reply(`**${character.name}** has been deleted. Use \`~crawl create\` to make a new character.`);
}
