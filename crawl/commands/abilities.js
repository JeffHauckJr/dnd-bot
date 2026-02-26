/**
 * Abilities Command Handler
 * View and manage character abilities outside of combat
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getCharacter } = require('../../utils/persistence');
const abilities = require('../../data/abilities.json');
const { getClassById, getAbilitiesForLevel } = require('../character/classes');

/**
 * Get ability emoji based on type
 */
function getAbilityEmoji(type) {
    switch (type) {
        case 'attack': return '⚔️';
        case 'attack_aoe': return '💥';
        case 'heal': return '💚';
        case 'heal_aoe': return '💖';
        case 'buff': return '✨';
        case 'defensive': return '🛡️';
        case 'reaction': return '⚡';
        case 'passive': return '🔮';
        case 'revive': return '💫';
        default: return '🎯';
    }
}

/**
 * Get ability type display name
 */
function getAbilityTypeName(type) {
    switch (type) {
        case 'attack': return 'Attack';
        case 'attack_aoe': return 'AoE Attack';
        case 'heal': return 'Healing';
        case 'heal_aoe': return 'AoE Healing';
        case 'buff': return 'Buff';
        case 'defensive': return 'Defensive';
        case 'reaction': return 'Reaction';
        case 'passive': return 'Passive';
        case 'revive': return 'Revive';
        default: return 'Ability';
    }
}

/**
 * Get full ability data from abilities.json
 */
function getAbilityData(classId, abilityId) {
    const classAbilities = abilities[classId];
    if (!classAbilities) return null;
    return classAbilities[abilityId] || null;
}

/**
 * Format ability damage/healing with stat scaling
 */
function formatAbilityPower(ability) {
    if (ability.damage) {
        return `Damage: ${ability.damage}${ability.damageType ? ` ${ability.damageType}` : ''}`;
    }
    if (ability.amount) {
        return `Healing: ${ability.amount}`;
    }
    return null;
}

/**
 * Format ability effects for display
 */
function formatAbilityEffects(ability) {
    const effects = [];

    if (ability.effect) {
        if (ability.effect.type === 'buff') {
            const buffs = [];
            if (ability.effect.attackBonus) buffs.push(`+${ability.effect.attackBonus} to hit`);
            if (ability.effect.damageBonus) buffs.push(`+${ability.effect.damageBonus} damage`);
            if (ability.effect.acBonus) buffs.push(`+${ability.effect.acBonus} AC`);
            if (ability.effect.damageResist) buffs.push(`${Math.round(ability.effect.damageResist * 100)}% damage resist`);
            if (ability.effect.advantage) buffs.push('Advantage on attacks');
            if (ability.effect.extraAttack) buffs.push('Extra attack');
            if (buffs.length > 0) effects.push(buffs.join(', '));
        }
        if (ability.effect.type === 'debuff') {
            if (ability.effect.acPenalty) effects.push(`-${ability.effect.acPenalty} AC to enemies`);
            if (ability.effect.flee) effects.push('Enemies may flee');
        }
    }

    if (ability.targets && ability.targets > 1) {
        effects.push(`Hits ${ability.targets} targets`);
    }

    if (ability.multiplier) {
        effects.push(`${ability.multiplier}x damage multiplier`);
    }

    if (ability.autoHit) {
        effects.push('Cannot miss');
    }

    if (ability.critRange) {
        effects.push(`Crit on ${ability.critRange}-20`);
    }

    if (ability.duration) {
        effects.push(`Lasts ${ability.duration} turn${ability.duration > 1 ? 's' : ''}`);
    }

    return effects;
}

/**
 * Main abilities command handler
 */
async function handleAbilities(msg, args) {
    const guildId = msg.guild.id;
    const userId = msg.author.id;

    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You don\'t have a character! Use `~crawl create` to make one.');
    }

    // If they specified an ability name, show details
    if (args.length > 0) {
        const abilityName = args.join(' ').toLowerCase();
        return showAbilityDetails(msg, character, abilityName, userId);
    }

    // Otherwise show ability list
    return showAbilityList(msg, character, userId);
}

/**
 * Show list of all character abilities
 */
async function showAbilityList(msg, character, userId) {
    const classData = getClassById(character.class);
    const classAbilities = abilities[character.class] || {};
    const characterAbilities = character.abilities || [];

    // Get all abilities this character could have at their level
    const availableAbilities = getAbilitiesForLevel(character.class, character.level);
    const availableIds = availableAbilities.map(a => a.id);

    // Build ability list
    let knownList = '';
    let upcomingList = '';

    // Known abilities
    for (const abilityId of characterAbilities) {
        const ability = classAbilities[abilityId];
        if (ability) {
            const emoji = getAbilityEmoji(ability.type);
            const cooldown = ability.cooldown > 0 ? ` (${ability.cooldown} turn CD)` : '';
            knownList += `${emoji} **${ability.name}**${cooldown}\n`;
            knownList += `  └ ${ability.description}\n`;
        }
    }

    if (!knownList) {
        knownList = '*No abilities learned yet.*';
    }

    // Find upcoming abilities (not yet learned due to level)
    const allClassAbilities = Object.values(classAbilities);
    for (const ability of allClassAbilities) {
        if (ability.unlockLevel > character.level) {
            const emoji = getAbilityEmoji(ability.type);
            upcomingList += `${emoji} **${ability.name}** (Level ${ability.unlockLevel})\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6) // Purple for magic/abilities
        .setTitle(`✨ ${character.name}'s Abilities`)
        .setDescription(
            `**Class:** ${classData?.name || character.class}\n` +
            `**Level:** ${character.level}\n\n` +
            `**Known Abilities:**\n${knownList}`
        )
        .setFooter({ text: 'Select an ability to view details' });

    if (upcomingList) {
        embed.addFields({
            name: '🔒 Upcoming Abilities',
            value: upcomingList,
            inline: false
        });
    }

    // Create ability select menu
    const components = [];

    if (characterAbilities.length > 0) {
        const selectOptions = characterAbilities
            .map(abilityId => {
                const ability = classAbilities[abilityId];
                if (!ability) return null;
                return {
                    label: ability.name,
                    description: ability.description?.substring(0, 100) || 'An ability',
                    value: abilityId,
                    emoji: getAbilityEmoji(ability.type)
                };
            })
            .filter(Boolean)
            .slice(0, 25);

        if (selectOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_abilityview_${userId}`)
                .setPlaceholder('Select an ability for details...')
                .addOptions(selectOptions);

            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    }

    // Close button
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_abilityclose_${userId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );
    components.push(closeRow);

    return msg.reply({ embeds: [embed], components });
}

/**
 * Show detailed view of a single ability
 */
async function showAbilityDetails(msg, character, abilityNameOrId, userId) {
    const classAbilities = abilities[character.class] || {};
    const characterAbilities = character.abilities || [];

    // Find ability by ID or name
    let ability = null;
    let abilityId = null;

    // First try exact ID match
    if (classAbilities[abilityNameOrId]) {
        ability = classAbilities[abilityNameOrId];
        abilityId = abilityNameOrId;
    } else {
        // Try name match
        for (const [id, ab] of Object.entries(classAbilities)) {
            if (ab.name.toLowerCase() === abilityNameOrId.toLowerCase() ||
                ab.name.toLowerCase().includes(abilityNameOrId.toLowerCase())) {
                ability = ab;
                abilityId = id;
                break;
            }
        }
    }

    if (!ability) {
        return msg.reply(`Ability not found: \`${abilityNameOrId}\`. Use \`~crawl abilities\` to see your abilities.`);
    }

    const isKnown = characterAbilities.includes(abilityId);
    const { embed } = createAbilityDetailEmbed(ability, character, isKnown, userId);

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_abilitylist_${userId}`)
            .setLabel('Back to List')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️'),
        new ButtonBuilder()
            .setCustomId(`crawl_abilityclose_${userId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );

    return msg.reply({ embeds: [embed], components: [closeRow] });
}

/**
 * Create detailed ability embed
 */
function createAbilityDetailEmbed(ability, character, isKnown, userId) {
    const emoji = getAbilityEmoji(ability.type);
    const typeName = getAbilityTypeName(ability.type);
    const power = formatAbilityPower(ability);
    const effects = formatAbilityEffects(ability);

    let color = 0x9B59B6; // Default purple
    if (!isKnown) color = 0x7F8C8D; // Gray for locked
    else if (ability.type.includes('attack')) color = 0xE74C3C; // Red for attacks
    else if (ability.type.includes('heal')) color = 0x2ECC71; // Green for heals
    else if (ability.type === 'buff') color = 0xF39C12; // Orange for buffs
    else if (ability.type === 'defensive') color = 0x3498DB; // Blue for defensive

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} ${ability.name}`)
        .setDescription(ability.description || 'No description available.');

    // Status field
    if (isKnown) {
        embed.addFields({ name: 'Status', value: '✅ Known', inline: true });
    } else {
        embed.addFields({ name: 'Status', value: `🔒 Unlocks at Level ${ability.unlockLevel}`, inline: true });
    }

    // Type field
    embed.addFields({ name: 'Type', value: typeName, inline: true });

    // Cooldown field
    if (ability.cooldown > 0) {
        embed.addFields({ name: 'Cooldown', value: `${ability.cooldown} turn${ability.cooldown > 1 ? 's' : ''}`, inline: true });
    } else {
        embed.addFields({ name: 'Cooldown', value: 'None', inline: true });
    }

    // Power field (damage/healing)
    if (power) {
        embed.addFields({ name: 'Power', value: power, inline: true });
    }

    // Effects field
    if (effects.length > 0) {
        embed.addFields({ name: 'Effects', value: effects.join('\n'), inline: false });
    }

    // Requirements
    const requirements = [];
    if (ability.requiresBuff) {
        requirements.push(`Requires active: ${ability.requiresBuff}`);
    }
    if (ability.condition) {
        const conditionText = {
            'target_full_hp': 'Target must be at full HP',
            'user_below_half': 'User must be below 50% HP'
        };
        requirements.push(conditionText[ability.condition] || ability.condition);
    }
    if (ability.targetType) {
        requirements.push(`Targets: ${ability.targetType} only`);
    }

    if (requirements.length > 0) {
        embed.addFields({ name: 'Requirements', value: requirements.join('\n'), inline: false });
    }

    embed.setFooter({ text: `Unlock Level: ${ability.unlockLevel}` });

    return { embed };
}

/**
 * Create ability list embed for interaction updates
 */
function createAbilityListEmbed(character, userId) {
    const classData = getClassById(character.class);
    const classAbilities = abilities[character.class] || {};
    const characterAbilities = character.abilities || [];

    let knownList = '';
    let upcomingList = '';

    for (const abilityId of characterAbilities) {
        const ability = classAbilities[abilityId];
        if (ability) {
            const emoji = getAbilityEmoji(ability.type);
            const cooldown = ability.cooldown > 0 ? ` (${ability.cooldown} turn CD)` : '';
            knownList += `${emoji} **${ability.name}**${cooldown}\n`;
            knownList += `  └ ${ability.description}\n`;
        }
    }

    if (!knownList) {
        knownList = '*No abilities learned yet.*';
    }

    const allClassAbilities = Object.values(classAbilities);
    for (const ability of allClassAbilities) {
        if (ability.unlockLevel > character.level) {
            const emoji = getAbilityEmoji(ability.type);
            upcomingList += `${emoji} **${ability.name}** (Level ${ability.unlockLevel})\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`✨ ${character.name}'s Abilities`)
        .setDescription(
            `**Class:** ${classData?.name || character.class}\n` +
            `**Level:** ${character.level}\n\n` +
            `**Known Abilities:**\n${knownList}`
        )
        .setFooter({ text: 'Select an ability to view details' });

    if (upcomingList) {
        embed.addFields({
            name: '🔒 Upcoming Abilities',
            value: upcomingList,
            inline: false
        });
    }

    const components = [];

    if (characterAbilities.length > 0) {
        const selectOptions = characterAbilities
            .map(abilityId => {
                const ability = classAbilities[abilityId];
                if (!ability) return null;
                return {
                    label: ability.name,
                    description: ability.description?.substring(0, 100) || 'An ability',
                    value: abilityId,
                    emoji: getAbilityEmoji(ability.type)
                };
            })
            .filter(Boolean)
            .slice(0, 25);

        if (selectOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_abilityview_${userId}`)
                .setPlaceholder('Select an ability for details...')
                .addOptions(selectOptions);

            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    }

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_abilityclose_${userId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );
    components.push(closeRow);

    return { embed, components };
}

module.exports = {
    handleAbilities,
    createAbilityDetailEmbed,
    createAbilityListEmbed,
    getAbilityData,
    getAbilityEmoji,
    getAbilityTypeName,
    formatAbilityPower,
    formatAbilityEffects
};
