const { EmbedBuilder } = require('discord.js');
const { getAllRaces, getRace } = require('../character/races');
const { getAllClasses, getClass, getAbilitiesForLevel, getStartingAbilities } = require('../character/classes');
const { getModifier } = require('../../utils/dice');
const { getXpToNextLevel, getProficiencyBonus } = require('../character/leveling');
const abilities = require('../../data/abilities.json');

/**
 * Create a character creation welcome embed
 * @returns {EmbedBuilder}
 */
function createWelcomeEmbed() {
    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Welcome to the Dungeon Crawler!')
        .setDescription('Create your character to begin your adventure.\n\nFirst, choose your **race**.')
        .setFooter({ text: 'Select a race from the buttons below' });
}

/**
 * Create a race selection embed
 * @returns {EmbedBuilder}
 */
function createRaceSelectionEmbed() {
    const races = getAllRaces();
    const fields = races.map(race => ({
        name: race.name,
        value: `${race.description}\n*Bonuses:* ${formatStatBonuses(race.statBonuses)}\n*Traits:* ${race.traits.map(t => t.name).join(', ')}`,
        inline: true
    }));

    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Choose Your Race')
        .setDescription('Each race has unique stat bonuses and special traits.')
        .addFields(fields)
        .setFooter({ text: 'Click a button below to select your race' });
}

/**
 * Create a class selection embed
 * @param {string} selectedRace
 * @returns {EmbedBuilder}
 */
function createClassSelectionEmbed(selectedRace) {
    const race = getRace(selectedRace);
    const classes = getAllClasses();

    // Class-specific weapon/armor options for display
    const classGear = {
        fighter: { weapons: 'Longsword, Greatsword, Battleaxe, Warhammer', armor: 'Leather, Chain Shirt, Scale Mail' },
        rogue: { weapons: 'Shortsword, Dagger, Rapier, Shortbow', armor: 'Leather, Padded' },
        cleric: { weapons: 'Mace, Warhammer, Morningstar', armor: 'Leather, Chain Shirt, Scale Mail' },
        wizard: { weapons: 'Quarterstaff, Dagger, Light Crossbow', armor: 'Robes, Padded' },
        ranger: { weapons: 'Longbow, Shortsword, Shortbow, Handaxe', armor: 'Leather, Hide' },
        barbarian: { weapons: 'Greataxe, Greatsword, Handaxe, Battleaxe', armor: 'Hide, Leather' }
    };

    const fields = classes.map(cls => {
        const classAbilities = abilities[cls.id] || {};
        const startingAbilityInfo = cls.startingAbilities.map(abilityId => {
            const ability = classAbilities[abilityId];
            if (!ability) return abilityId;

            // Mark magic abilities with a sparkle
            const isMagic = ability.damageType === 'force' || ability.damageType === 'radiant' ||
                           ability.damageType === 'fire' || ability.type === 'heal' ||
                           ability.autoHit || abilityId === 'shield';
            const magicMarker = isMagic ? '✨' : '';

            return `${magicMarker}**${ability.name}**: ${ability.description}`;
        }).join('\n');

        const gear = classGear[cls.id] || { weapons: 'Basic', armor: 'Basic' };

        return {
            name: `${cls.name} (d${cls.hitDie} HP)`,
            value: `${cls.description}\n\n` +
                   `**Primary:** ${capitalize(cls.primaryStat)}\n` +
                   `**Starting Abilities:**\n${startingAbilityInfo}\n\n` +
                   `**Weapons:** ${gear.weapons}\n` +
                   `**Armor:** ${gear.armor}`,
            inline: false
        };
    });

    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Choose Your Class')
        .setDescription(`You selected **${race.name}**.\n\nNow choose your class. This determines your combat abilities and hit points.\n\n✨ = Magic/Spell ability`)
        .addFields(fields)
        .setFooter({ text: 'Click a button below to select your class' });
}

/**
 * Create a name input embed
 * @param {string} selectedRace
 * @param {string} selectedClass
 * @returns {EmbedBuilder}
 */
function createNameInputEmbed(selectedRace, selectedClass) {
    const race = getRace(selectedRace);
    const cls = getClass(selectedClass);

    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Name Your Character')
        .setDescription(`You will be a **${race.name} ${cls.name}**.\n\nType your character's name in chat to complete creation.`)
        .setFooter({ text: 'Type a name (3-20 characters)' });
}

/**
 * Create a character sheet embed
 * @param {object} character
 * @returns {EmbedBuilder}
 */
function createCharacterSheetEmbed(character) {
    const race = getRace(character.race);
    const cls = getClass(character.class);
    const profBonus = getProficiencyBonus(character.level);

    const statsStr = formatStats(character.stats);
    const xpProgress = `${character.xp} / ${getXpToNextLevel(character.level)}`;

    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle(`${character.name}`)
        .setDescription(`Level ${character.level} ${race.name} ${cls.name}`)
        .addFields(
            { name: 'HP', value: `${character.currentHp} / ${character.maxHp}`, inline: true },
            { name: 'AC', value: `${character.armorClass}`, inline: true },
            { name: 'Gold', value: `${character.gold}`, inline: true },
            { name: 'Stats', value: statsStr, inline: false },
            { name: 'XP', value: xpProgress, inline: true },
            { name: 'Proficiency', value: `+${profBonus}`, inline: true },
            { name: 'Dungeons Completed', value: `${character.dungeonsCompleted}`, inline: true }
        );

    // Add abilities
    const abilities = character.abilities || [];
    if (abilities.length > 0) {
        embed.addFields({
            name: 'Abilities',
            value: abilities.join(', ') || 'None',
            inline: false
        });
    }

    // Add equipment summary
    const equipment = [];
    if (character.equipment?.weapon) equipment.push(`Weapon: ${character.equipment.weapon.name}`);
    if (character.equipment?.armor) equipment.push(`Armor: ${character.equipment.armor.name}`);
    if (character.equipment?.accessory) equipment.push(`Accessory: ${character.equipment.accessory.name}`);

    if (equipment.length > 0) {
        embed.addFields({
            name: 'Equipment',
            value: equipment.join('\n'),
            inline: false
        });
    }

    embed.setFooter({ text: `Monsters Slain: ${character.monstersSlain}` });

    return embed;
}

/**
 * Create a character creation confirmation embed
 * @param {object} character
 * @returns {EmbedBuilder}
 */
function createCharacterCreatedEmbed(character) {
    const race = getRace(character.race);
    const cls = getClass(character.class);

    return new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Character Created!')
        .setDescription(`Welcome, **${character.name}** the ${race.name} ${cls.name}!`)
        .addFields(
            { name: 'HP', value: `${character.maxHp}`, inline: true },
            { name: 'AC', value: `${character.armorClass}`, inline: true },
            { name: 'Starting Gold', value: `${character.gold}`, inline: true },
            { name: 'Stats', value: formatStats(character.stats), inline: false },
            { name: 'Starting Abilities', value: character.abilities.join(', '), inline: false }
        )
        .setFooter({ text: 'Use ~crawl start to begin your first dungeon!' });
}

/**
 * Create a level up notification embed
 * @param {object} character
 * @param {object} levelUpInfo
 * @returns {EmbedBuilder}
 */
function createLevelUpEmbed(character, levelUpInfo) {
    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('Level Up!')
        .setDescription(`**${character.name}** has reached level ${levelUpInfo.newLevel}!`)
        .addFields(
            { name: 'HP Gained', value: `+${levelUpInfo.hpGained} (Max HP: ${levelUpInfo.newMaxHp})`, inline: true }
        );

    if (levelUpInfo.newAbility) {
        embed.addFields({
            name: 'New Ability Unlocked',
            value: `**${levelUpInfo.newAbility.name}**\n${levelUpInfo.newAbility.description}`,
            inline: false
        });
    }

    if (levelUpInfo.statPoints > 0) {
        embed.addFields({
            name: 'Stat Points',
            value: `You have ${levelUpInfo.statPoints} stat points to allocate! Use \`~crawl stats\` to assign them.`,
            inline: false
        });
    }

    return embed;
}

/**
 * Create a dungeon start embed
 * @param {object} dungeon
 * @param {object[]} party
 * @returns {EmbedBuilder}
 */
function createDungeonStartEmbed(dungeon, party) {
    const partyList = party.map(p => `${p.name} (Lvl ${p.level} ${p.class})`).join('\n');

    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Entering the Dungeon...')
        .setDescription(`A dark passage opens before you. The dungeon awaits.`)
        .addFields(
            { name: 'Party', value: partyList, inline: true },
            { name: 'Difficulty', value: `Level ${dungeon.difficulty}`, inline: true },
            { name: 'Rooms', value: `${dungeon.totalRooms}`, inline: true }
        )
        .setFooter({ text: 'Prepare for battle!' });
}

/**
 * Create a combat embed
 * @param {object} combat
 * @param {object[]} party
 * @param {object[]} monsters
 * @param {string} currentTurnName
 * @returns {EmbedBuilder}
 */
function createCombatEmbed(combat, party, monsters, currentTurnName) {
    // Party status
    const partyStatus = party.map(p => {
        const hpBar = createHpBar(p.currentHp, p.maxHp);
        return `**${p.name}** ${hpBar} ${p.currentHp}/${p.maxHp}`;
    }).join('\n');

    // Monster status
    const monsterStatus = monsters.map((m, i) => {
        const hpBar = createHpBar(m.currentHp, m.maxHp);
        return `**${m.name}** ${hpBar} ${m.currentHp}/${m.maxHp}`;
    }).join('\n');

    // Turn order display
    const turnOrder = combat.turnOrder
        .filter(t => t.isAlive)
        .map((t, i) => {
            const marker = i === combat.currentTurnIndex ? '>' : ' ';
            return `${marker} ${t.name} (${t.initiative})`;
        }).join('\n');

    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`Combat - Round ${combat.round}`)
        .setDescription(`**${currentTurnName}'s Turn**`)
        .addFields(
            { name: 'Party', value: partyStatus || 'None', inline: true },
            { name: 'Enemies', value: monsterStatus || 'None', inline: true },
            { name: 'Initiative Order', value: `\`\`\`${turnOrder}\`\`\``, inline: false }
        );
}

/**
 * Create a room cleared embed
 * @param {number} roomNumber
 * @param {number} totalRooms
 * @param {object} rewards
 * @returns {EmbedBuilder}
 */
function createRoomClearedEmbed(roomNumber, totalRooms, rewards) {
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Room Cleared!')
        .setDescription(`Room ${roomNumber + 1} of ${totalRooms} completed.`);

    if (rewards.xp > 0) {
        embed.addFields({ name: 'XP Earned', value: `${rewards.xp}`, inline: true });
    }
    if (rewards.gold > 0) {
        embed.addFields({ name: 'Gold Found', value: `${rewards.gold}`, inline: true });
    }
    if (rewards.items && rewards.items.length > 0) {
        embed.addFields({ name: 'Loot', value: rewards.items.map(i => i.name).join('\n'), inline: false });
    }

    if (roomNumber + 1 < totalRooms) {
        embed.setFooter({ text: 'Proceed to the next room or retreat with your loot.' });
    } else {
        embed.setFooter({ text: 'Dungeon Complete!' });
    }

    return embed;
}

/**
 * Create a dungeon complete embed
 * @param {object} character
 * @param {object} rewards
 * @returns {EmbedBuilder}
 */
function createDungeonCompleteEmbed(character, rewards) {
    return new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('Dungeon Complete!')
        .setDescription(`**${character.name}** has conquered the dungeon!`)
        .addFields(
            { name: 'Total XP', value: `${rewards.totalXp}`, inline: true },
            { name: 'Total Gold', value: `${rewards.totalGold}`, inline: true },
            { name: 'Monsters Slain', value: `${rewards.monstersSlain}`, inline: true }
        )
        .setFooter({ text: 'Use ~crawl start to begin another dungeon!' });
}

/**
 * Create a defeat embed
 * @param {object} character
 * @returns {EmbedBuilder}
 */
function createDefeatEmbed(character) {
    return new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Defeat...')
        .setDescription(`**${character.name}** has fallen in the dungeon.`)
        .addFields(
            { name: 'XP Kept', value: `50% of earned XP`, inline: true }
        )
        .setFooter({ text: 'Your equipment and gold are safe. Try again!' });
}

// Helper functions

function formatStatBonuses(bonuses) {
    return Object.entries(bonuses)
        .map(([stat, bonus]) => `+${bonus} ${stat.substring(0, 3).toUpperCase()}`)
        .join(', ');
}

function formatStats(stats) {
    const lines = [];
    const statOrder = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

    for (const stat of statOrder) {
        const value = stats[stat];
        const mod = getModifier(value);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        lines.push(`**${stat.substring(0, 3).toUpperCase()}**: ${value} (${modStr})`);
    }

    return lines.join(' | ');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function createHpBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

module.exports = {
    createWelcomeEmbed,
    createRaceSelectionEmbed,
    createClassSelectionEmbed,
    createNameInputEmbed,
    createCharacterSheetEmbed,
    createCharacterCreatedEmbed,
    createLevelUpEmbed,
    createDungeonStartEmbed,
    createCombatEmbed,
    createRoomClearedEmbed,
    createDungeonCompleteEmbed,
    createDefeatEmbed
};
