const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCharacter, saveCharacter } = require('../../utils/persistence');
const { getXpToNextLevel, applyStatPoints } = require('../character/leveling');
const { getModifier } = require('../../utils/dice');

/**
 * Handle ~crawl levelup command
 * Shows character level status and allows stat point allocation
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleLevelUp(msg, args) {
    const guildId = msg.guild.id;
    const userId = msg.author.id;

    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You don\'t have a character! Use `~crawl create` to make one.');
    }

    const xpToNext = getXpToNextLevel(character.level);
    const xpProgress = character.xp;
    const xpNeeded = xpToNext - xpProgress;

    let description = `**Level:** ${character.level}\n`;
    description += `**XP:** ${xpProgress.toLocaleString()} / ${xpToNext.toLocaleString()}\n`;
    description += `**XP to Next Level:** ${xpNeeded.toLocaleString()}\n\n`;

    // Show current stats
    description += '**Current Stats:**\n';
    description += `STR: ${character.stats.strength} (${formatMod(getModifier(character.stats.strength))})\n`;
    description += `DEX: ${character.stats.dexterity} (${formatMod(getModifier(character.stats.dexterity))})\n`;
    description += `CON: ${character.stats.constitution} (${formatMod(getModifier(character.stats.constitution))})\n`;
    description += `INT: ${character.stats.intelligence} (${formatMod(getModifier(character.stats.intelligence))})\n`;
    description += `WIS: ${character.stats.wisdom} (${formatMod(getModifier(character.stats.wisdom))})\n`;
    description += `CHA: ${character.stats.charisma} (${formatMod(getModifier(character.stats.charisma))})\n`;

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`${character.name} - Level ${character.level}`)
        .setDescription(description)
        .setFooter({ text: character.pendingStatPoints > 0 ? 'You have stat points to allocate!' : 'Earn XP by completing dungeons' });

    const components = [];

    // If there are pending stat points, show allocation UI
    if (character.pendingStatPoints && character.pendingStatPoints >= 2) {
        embed.addFields({
            name: '🎉 Stat Points Available!',
            value: `You have **${character.pendingStatPoints}** stat points to allocate.\nSelect two stats to increase (can be the same stat twice).`,
            inline: false
        });

        const statOptions = [
            { label: 'Strength', value: 'strength', description: `Current: ${character.stats.strength}`, emoji: '💪' },
            { label: 'Dexterity', value: 'dexterity', description: `Current: ${character.stats.dexterity}`, emoji: '🏃' },
            { label: 'Constitution', value: 'constitution', description: `Current: ${character.stats.constitution}`, emoji: '❤️' },
            { label: 'Intelligence', value: 'intelligence', description: `Current: ${character.stats.intelligence}`, emoji: '📚' },
            { label: 'Wisdom', value: 'wisdom', description: `Current: ${character.stats.wisdom}`, emoji: '🦉' },
            { label: 'Charisma', value: 'charisma', description: `Current: ${character.stats.charisma}`, emoji: '✨' }
        ];

        const stat1Menu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_statpoint1_${userId}`)
            .setPlaceholder('First stat point...')
            .addOptions(statOptions);

        const stat2Menu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_statpoint2_${userId}`)
            .setPlaceholder('Second stat point...')
            .addOptions(statOptions);

        components.push(new ActionRowBuilder().addComponents(stat1Menu));
        components.push(new ActionRowBuilder().addComponents(stat2Menu));
    }

    await msg.reply({ embeds: [embed], components });
}

function formatMod(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

module.exports = {
    handleLevelUp
};
