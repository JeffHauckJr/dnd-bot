const { EmbedBuilder } = require('discord.js');

/**
 * Handle the ~crawl help command
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleHelp(msg, args) {
    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Dungeon Crawler Commands')
        .setDescription('Embark on adventures, fight monsters, and collect loot!')
        .addFields(
            {
                name: 'Getting Started',
                value: '`~crawl create` - Create your character\n`~crawl stats` - View your character sheet\n`~crawl start` - Begin a dungeon run',
                inline: false
            },
            {
                name: 'Character Management',
                value: '`~crawl inventory` - View your inventory\n`~crawl abilities` - View your abilities\n`~crawl delete` - Delete your character',
                inline: false
            },
            {
                name: 'Party System',
                value: '`~crawl party create` - Create a party\n`~crawl party invite @user` - Invite someone\n`~crawl party leave` - Leave your party\n`~crawl party disband` - Disband (leader only)',
                inline: false
            },
            {
                name: 'Other',
                value: '`~crawl leaderboard` - View server rankings\n`~crawl stats @user` - View another player\'s stats',
                inline: false
            }
        )
        .setFooter({ text: 'Use buttons during combat to take actions!' });

    await msg.reply({ embeds: [embed] });
}

module.exports = { handleHelp };
