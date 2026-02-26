const { getCharacter, saveCharacter } = require('../../utils/persistence');
const { createRaceSelectionEmbed, createCharacterCreatedEmbed } = require('../ui/embeds');
const { createRaceButtons } = require('../ui/buttons');
const { getRace, applyRacialBonuses, getRacialEffects } = require('../character/races');
const { getClass, getStartingHp, getBaseArmorBonus, getStartingAbilities } = require('../character/classes');
const { getModifier, rollAbilityScores } = require('../../utils/dice');
const { getXpToNextLevel } = require('../character/leveling');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

// Store pending character creations
const pendingCreations = new Map();

// Point buy costs (3.5e style)
const POINT_BUY_COSTS = {
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8
};
const POINT_BUY_TOTAL = 27;

/**
 * Handle the ~crawl create command
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleCreate(msg, args) {
    const guildId = msg.guild.id;
    const odiscordUserId = msg.author.id;

    // Check if character already exists
    const existingChar = await getCharacter(guildId, odiscordUserId);
    if (existingChar) {
        return msg.reply(`You already have a character named **${existingChar.name}**! Use \`~crawl delete\` first if you want to start over.`);
    }

    // Check if already in creation process
    if (pendingCreations.has(`${guildId}-${odiscordUserId}`)) {
        return msg.reply('You already have a character creation in progress. Please complete it or wait for it to expire.');
    }

    // Start character creation
    const embed = createRaceSelectionEmbed();
    const buttons = createRaceButtons(odiscordUserId);

    const reply = await msg.reply({
        embeds: [embed],
        components: buttons
    });

    // Store the creation state
    pendingCreations.set(`${guildId}-${odiscordUserId}`, {
        odiscordUserId,
        guildId,
        step: 'race',
        messageId: reply.id,
        channelId: msg.channel.id,
        createdAt: Date.now()
    });

    // Expire after 10 minutes
    setTimeout(() => {
        pendingCreations.delete(`${guildId}-${odiscordUserId}`);
    }, 10 * 60 * 1000);
}

/**
 * Handle race selection from button
 */
async function handleRaceSelection(interaction, odiscordUserId, raceId) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'race') {
        return interaction.reply({ content: 'Character creation expired. Please start again with `~crawl create`.', ephemeral: true });
    }

    creation.race = raceId;
    creation.step = 'class';

    const { createClassSelectionEmbed } = require('../ui/embeds');
    const { createClassButtons } = require('../ui/buttons');

    const embed = createClassSelectionEmbed(raceId);
    const buttons = createClassButtons(odiscordUserId, raceId);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

/**
 * Handle class selection - now goes to stat method selection
 */
async function handleClassSelection(interaction, odiscordUserId, raceId, classId) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'class') {
        return interaction.reply({ content: 'Character creation expired. Please start again with `~crawl create`.', ephemeral: true });
    }

    creation.class = classId;
    creation.step = 'stat_method';

    // Show stat allocation method selection
    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Choose Stat Allocation Method')
        .setDescription('How would you like to determine your ability scores?')
        .addFields(
            { name: 'Random Roll', value: 'Roll 4d6, drop lowest, for each stat. Classic D&D style!', inline: true },
            { name: 'Point Buy', value: `${POINT_BUY_TOTAL} points to distribute. Stats range 8-15.`, inline: true },
            { name: 'Standard Array', value: '15, 14, 13, 12, 10, 8 - assign as you wish.', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_statmethod_${odiscordUserId}_random`)
            .setLabel('Random Roll')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎲'),
        new ButtonBuilder()
            .setCustomId(`crawl_statmethod_${odiscordUserId}_pointbuy`)
            .setLabel('Point Buy')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
        new ButtonBuilder()
            .setCustomId(`crawl_statmethod_${odiscordUserId}_standard`)
            .setLabel('Standard Array')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
    );

    await interaction.update({
        embeds: [embed],
        components: [row]
    });
}

/**
 * Handle stat method selection
 */
async function handleStatMethodSelection(interaction, odiscordUserId, method) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'stat_method') {
        return interaction.reply({ content: 'Character creation expired. Please start again with `~crawl create`.', ephemeral: true });
    }

    creation.statMethod = method;

    if (method === 'random') {
        // Roll stats immediately
        const rolled = rollAbilityScores();
        creation.stats = {
            strength: rolled[0],
            dexterity: rolled[1],
            constitution: rolled[2],
            intelligence: rolled[3],
            wisdom: rolled[4],
            charisma: rolled[5]
        };
        creation.step = 'gear';
        await showGearSelection(interaction, creation, odiscordUserId);
    } else if (method === 'standard') {
        // Show standard array assignment
        creation.standardArray = [15, 14, 13, 12, 10, 8];
        creation.stats = {};
        creation.step = 'assign_stats';
        await showStatAssignment(interaction, creation, odiscordUserId);
    } else if (method === 'pointbuy') {
        // Show point buy interface
        creation.pointsRemaining = POINT_BUY_TOTAL;
        creation.stats = {
            strength: 8,
            dexterity: 8,
            constitution: 8,
            intelligence: 8,
            wisdom: 8,
            charisma: 8
        };
        creation.step = 'point_buy';
        await showPointBuyInterface(interaction, creation, odiscordUserId);
    }
}

/**
 * Show point buy interface - all 6 stats on one screen
 */
async function showPointBuyInterface(interaction, creation, odiscordUserId) {
    const stats = creation.stats;
    const pointsRemaining = creation.pointsRemaining;
    const allStatNames = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const allStatLabels = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Point Buy - Allocate Your Stats')
        .setDescription(`**Points Remaining: ${pointsRemaining}**\n\n1. Select a stat to change\n2. Select the new value\n\n*Cost: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=6, 15=8*`)
        .addFields(
            { name: 'STR', value: `**${stats.strength}** (${POINT_BUY_COSTS[stats.strength]} pts)`, inline: true },
            { name: 'DEX', value: `**${stats.dexterity}** (${POINT_BUY_COSTS[stats.dexterity]} pts)`, inline: true },
            { name: 'CON', value: `**${stats.constitution}** (${POINT_BUY_COSTS[stats.constitution]} pts)`, inline: true },
            { name: 'INT', value: `**${stats.intelligence}** (${POINT_BUY_COSTS[stats.intelligence]} pts)`, inline: true },
            { name: 'WIS', value: `**${stats.wisdom}** (${POINT_BUY_COSTS[stats.wisdom]} pts)`, inline: true },
            { name: 'CHA', value: `**${stats.charisma}** (${POINT_BUY_COSTS[stats.charisma]} pts)`, inline: true }
        );

    const rows = [];

    // Row 1: Select which stat to change
    const statMenu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_pointbuystat_${odiscordUserId}`)
        .setPlaceholder('Select a stat to change...')
        .addOptions(allStatNames.map((name, i) => ({
            label: `${allStatLabels[i]}: ${stats[name]}`,
            description: `Currently ${stats[name]} (${POINT_BUY_COSTS[stats[name]]} points)`,
            value: name
        })));
    rows.push(new ActionRowBuilder().addComponents(statMenu));

    // Row 2: Select the value (shown after stat is picked, or show all values)
    const selectedStat = creation.selectedPointBuyStat || null;
    const valueMenu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_pointbuyval_${odiscordUserId}`)
        .setPlaceholder(selectedStat ? `Set ${selectedStat.toUpperCase()} value...` : 'Pick a stat first, then a value...')
        .addOptions([8, 9, 10, 11, 12, 13, 14, 15].map(val => ({
            label: `${val} (${POINT_BUY_COSTS[val]} pts)`,
            description: selectedStat ? `Set ${selectedStat.toUpperCase()} to ${val}` : `Value: ${val}`,
            value: val.toString(),
            default: selectedStat ? stats[selectedStat] === val : false
        })));
    rows.push(new ActionRowBuilder().addComponents(valueMenu));

    // Row 3: Confirm button
    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_pointbuy_confirm_${odiscordUserId}`)
            .setLabel('Confirm Stats')
            .setStyle(ButtonStyle.Success)
            .setDisabled(pointsRemaining < 0)
    );
    rows.push(confirmRow);

    await interaction.update({
        embeds: [embed],
        components: rows
    });
}

/**
 * Handle point buy stat change
 */
async function handlePointBuyChange(interaction, odiscordUserId, statName, value) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'point_buy') {
        return interaction.reply({ content: 'Character creation expired.', ephemeral: true });
    }

    const newValue = parseInt(value);
    const oldValue = creation.stats[statName];
    const oldCost = POINT_BUY_COSTS[oldValue];
    const newCost = POINT_BUY_COSTS[newValue];

    creation.pointsRemaining += oldCost - newCost;
    creation.stats[statName] = newValue;

    await showPointBuyInterface(interaction, creation, odiscordUserId);
}

/**
 * Handle showing more stats in point buy
 */
async function handlePointBuyMore(interaction, odiscordUserId) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'point_buy') {
        return interaction.reply({ content: 'Character creation expired.', ephemeral: true });
    }

    const stats = creation.stats;
    const pointsRemaining = creation.pointsRemaining;

    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Point Buy - Mental Stats')
        .setDescription(`**Points Remaining: ${pointsRemaining}**`)
        .addFields(
            { name: 'STR', value: `${stats.strength}`, inline: true },
            { name: 'DEX', value: `${stats.dexterity}`, inline: true },
            { name: 'CON', value: `${stats.constitution}`, inline: true },
            { name: 'INT', value: `${stats.intelligence}`, inline: true },
            { name: 'WIS', value: `${stats.wisdom}`, inline: true },
            { name: 'CHA', value: `${stats.charisma}`, inline: true }
        );

    const rows = [];
    const mentalStats = ['intelligence', 'wisdom', 'charisma'];
    const mentalLabels = ['INT', 'WIS', 'CHA'];

    for (let i = 0; i < 3; i++) {
        const currentValue = stats[mentalStats[i]];
        const statOptions = [8, 9, 10, 11, 12, 13, 14, 15].map(val => ({
            label: `${val} (${POINT_BUY_COSTS[val]} pts)`,
            value: val.toString(),
            default: val === currentValue
        }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_pointbuy_${odiscordUserId}_${mentalStats[i]}`)
            .setPlaceholder(`${mentalLabels[i]}: ${currentValue}`)
            .addOptions(statOptions);
        rows.push(new ActionRowBuilder().addComponents(menu));
    }

    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_pointbuy_back_${odiscordUserId}`)
            .setLabel('Back (STR/DEX/CON)')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`crawl_pointbuy_confirm_${odiscordUserId}`)
            .setLabel('Confirm Stats')
            .setStyle(ButtonStyle.Success)
            .setDisabled(pointsRemaining < 0)
    );
    rows.push(confirmRow);

    await interaction.update({
        embeds: [embed],
        components: rows
    });
}

/**
 * Show standard array assignment
 */
async function showStatAssignment(interaction, creation, odiscordUserId) {
    const remaining = creation.standardArray;
    const assigned = creation.stats;

    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Standard Array - Assign Your Stats')
        .setDescription(`**Remaining values:** ${remaining.join(', ') || 'All assigned!'}\n\nSelect a stat to assign a value to.`)
        .addFields(
            { name: 'STR', value: assigned.strength ? `**${assigned.strength}**` : '_unassigned_', inline: true },
            { name: 'DEX', value: assigned.dexterity ? `**${assigned.dexterity}**` : '_unassigned_', inline: true },
            { name: 'CON', value: assigned.constitution ? `**${assigned.constitution}**` : '_unassigned_', inline: true },
            { name: 'INT', value: assigned.intelligence ? `**${assigned.intelligence}**` : '_unassigned_', inline: true },
            { name: 'WIS', value: assigned.wisdom ? `**${assigned.wisdom}**` : '_unassigned_', inline: true },
            { name: 'CHA', value: assigned.charisma ? `**${assigned.charisma}**` : '_unassigned_', inline: true }
        );

    const rows = [];

    if (remaining.length > 0) {
        // Show stat selection menu
        const statMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_assignstat_${odiscordUserId}`)
            .setPlaceholder('Choose a stat to assign')
            .addOptions(
                ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
                    .filter(stat => !assigned[stat])
                    .map(stat => ({
                        label: stat.charAt(0).toUpperCase() + stat.slice(1),
                        value: stat
                    }))
            );
        rows.push(new ActionRowBuilder().addComponents(statMenu));

        // Show value selection menu
        const valueMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_assignvalue_${odiscordUserId}`)
            .setPlaceholder('Choose a value')
            .addOptions(remaining.map(val => ({
                label: val.toString(),
                value: val.toString()
            })));
        rows.push(new ActionRowBuilder().addComponents(valueMenu));
    }

    // Confirm button (only if all assigned)
    if (remaining.length === 0) {
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_assignconfirm_${odiscordUserId}`)
                .setLabel('Confirm Stats')
                .setStyle(ButtonStyle.Success)
        );
        rows.push(confirmRow);
    }

    await interaction.update({
        embeds: [embed],
        components: rows
    });
}

/**
 * Handle standard array stat assignment
 */
async function handleStatAssignment(interaction, odiscordUserId, statName, value) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'assign_stats') {
        return interaction.reply({ content: 'Character creation expired.', ephemeral: true });
    }

    // Store selection temporarily
    if (!creation.pendingAssign) {
        creation.pendingAssign = {};
    }

    if (statName) {
        creation.pendingAssign.stat = statName;
    }
    if (value) {
        creation.pendingAssign.value = parseInt(value);
    }

    // If both selected, make assignment
    if (creation.pendingAssign.stat && creation.pendingAssign.value) {
        const stat = creation.pendingAssign.stat;
        const val = creation.pendingAssign.value;

        if (!creation.standardArray.includes(val)) {
            return interaction.reply({ content: 'That value is no longer available.', ephemeral: true });
        }

        creation.stats[stat] = val;
        creation.standardArray = creation.standardArray.filter(v => v !== val);
        creation.pendingAssign = {};
    }

    await showStatAssignment(interaction, creation, odiscordUserId);
}

/**
 * Show gear selection
 */
async function showGearSelection(interaction, creation, odiscordUserId) {
    const classId = creation.class;
    const cls = getClass(classId);
    const items = require('../../data/items.json');

    // Get class-appropriate starting gear options
    const weaponOptions = getStartingWeaponsForClass(classId, items);
    const armorOptions = getStartingArmorForClass(classId, items);

    creation.step = 'gear';
    creation.gearOptions = { weapons: weaponOptions, armor: armorOptions };

    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Choose Starting Equipment')
        .setDescription(`As a **${cls.name}**, select your starting weapon and armor.`)
        .addFields(
            { name: 'Stats', value: formatStats(creation.stats), inline: false }
        );

    const rows = [];

    // Weapon menu
    const weaponMenu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_gear_weapon_${odiscordUserId}`)
        .setPlaceholder('Choose your weapon')
        .addOptions(weaponOptions.map(w => ({
            label: w.name,
            description: `${w.damage} ${w.damageType}`,
            value: w.id
        })));
    rows.push(new ActionRowBuilder().addComponents(weaponMenu));

    // Armor menu
    const armorMenu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_gear_armor_${odiscordUserId}`)
        .setPlaceholder('Choose your armor')
        .addOptions(armorOptions.map(a => ({
            label: a.name,
            description: `AC +${a.acBonus}`,
            value: a.id
        })));
    rows.push(new ActionRowBuilder().addComponents(armorMenu));

    await interaction.update({
        embeds: [embed],
        components: rows
    });
}

/**
 * Handle gear selection
 */
async function handleGearSelection(interaction, odiscordUserId, gearType, gearId) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', ephemeral: true });
    }

    const creation = pendingCreations.get(key);
    if (!creation || creation.step !== 'gear') {
        return interaction.reply({ content: 'Character creation expired.', ephemeral: true });
    }

    const items = require('../../data/items.json');

    if (gearType === 'weapon') {
        creation.selectedWeapon = items.weapons.find(w => w.id === gearId);
    } else if (gearType === 'armor') {
        creation.selectedArmor = items.armor.find(a => a.id === gearId);
    }

    // Check if both selected
    if (creation.selectedWeapon && creation.selectedArmor) {
        creation.step = 'name';
        await showNameInput(interaction, creation, odiscordUserId);
    } else {
        // Update to show selection
        const cls = getClass(creation.class);
        const embed = new EmbedBuilder()
            .setColor(0x7B2D26)
            .setTitle('Choose Starting Equipment')
            .setDescription(`As a **${cls.name}**, select your starting weapon and armor.`)
            .addFields(
                { name: 'Stats', value: formatStats(creation.stats), inline: false },
                { name: 'Weapon', value: creation.selectedWeapon ? `**${creation.selectedWeapon.name}**` : '_not selected_', inline: true },
                { name: 'Armor', value: creation.selectedArmor ? `**${creation.selectedArmor.name}**` : '_not selected_', inline: true }
            );

        const rows = [];
        const weaponOptions = creation.gearOptions.weapons;
        const armorOptions = creation.gearOptions.armor;

        if (!creation.selectedWeapon) {
            const weaponMenu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_gear_weapon_${odiscordUserId}`)
                .setPlaceholder('Choose your weapon')
                .addOptions(weaponOptions.map(w => ({
                    label: w.name,
                    description: `${w.damage} ${w.damageType}`,
                    value: w.id
                })));
            rows.push(new ActionRowBuilder().addComponents(weaponMenu));
        }

        if (!creation.selectedArmor) {
            const armorMenu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_gear_armor_${odiscordUserId}`)
                .setPlaceholder('Choose your armor')
                .addOptions(armorOptions.map(a => ({
                    label: a.name,
                    description: `AC +${a.acBonus}`,
                    value: a.id
                })));
            rows.push(new ActionRowBuilder().addComponents(armorMenu));
        }

        await interaction.update({
            embeds: [embed],
            components: rows
        });
    }
}

/**
 * Show name input prompt
 */
async function showNameInput(interaction, creation, odiscordUserId) {
    const race = getRace(creation.race);
    const cls = getClass(creation.class);

    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Name Your Character')
        .setDescription(`Your **${race.name} ${cls.name}** is almost ready!\n\n**Stats:** ${formatStats(creation.stats)}\n**Weapon:** ${creation.selectedWeapon?.name || 'None'}\n**Armor:** ${creation.selectedArmor?.name || 'None'}\n\nType your character's name in chat (3-20 characters):`)
        .setFooter({ text: 'You have 60 seconds to enter a name.' });

    await interaction.update({
        embeds: [embed],
        components: []
    });

    // Set up message collector for name input
    const filter = m => m.author.id === odiscordUserId;
    const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async (m) => {
        const name = m.content.trim();
        const guildId = interaction.guild.id;
        const key = `${guildId}-${odiscordUserId}`;

        if (name.length < 3 || name.length > 20) {
            await interaction.followUp({ content: 'Name must be between 3 and 20 characters. Creation cancelled.', ephemeral: true });
            pendingCreations.delete(key);
            return;
        }

        try {
            const character = await createCharacterFromCreation(guildId, odiscordUserId, name, creation);
            const embed = createCharacterCreatedEmbed(character);

            await interaction.followUp({ embeds: [embed] });
            pendingCreations.delete(key);

            try { await m.delete(); } catch (e) {}
        } catch (error) {
            console.error('Error creating character:', error);
            await interaction.followUp({ content: 'Error creating character. Please try again.', ephemeral: true });
            pendingCreations.delete(key);
        }
    });

    collector.on('end', (collected, reason) => {
        const key = `${interaction.guild.id}-${odiscordUserId}`;
        if (reason === 'time' && pendingCreations.has(key)) {
            interaction.followUp({ content: 'Character creation timed out. Please start again with `~crawl create`.', ephemeral: true });
            pendingCreations.delete(key);
        }
    });
}

/**
 * Create character from the creation state
 */
async function createCharacterFromCreation(guildId, odiscordUserId, name, creation) {
    const raceId = creation.race;
    const classId = creation.class;
    const race = getRace(raceId);
    const cls = getClass(classId);
    const racialEffects = getRacialEffects(raceId);

    // Apply racial bonuses to stats
    const stats = applyRacialBonuses(creation.stats, raceId);

    // Calculate derived stats
    const conMod = getModifier(stats.constitution);
    const dexMod = getModifier(stats.dexterity);

    let maxHp = getStartingHp(classId, conMod);
    if (racialEffects.hpPerLevel) {
        maxHp += racialEffects.hpPerLevel;
    }

    // Calculate AC from armor selection
    let armorClass = 10 + dexMod;
    if (creation.selectedArmor) {
        armorClass = 10 + dexMod + creation.selectedArmor.acBonus;
    }

    const startingAbilities = getStartingAbilities(classId);
    const abilityIds = startingAbilities.map(a => a.id);

    const character = {
        id: `${guildId}-${odiscordUserId}`,
        odiscordUserId,
        guildId,
        name,
        race: raceId,
        class: classId,
        level: 1,
        xp: 0,
        xpToNextLevel: getXpToNextLevel(1),
        stats,
        maxHp,
        currentHp: maxHp,
        armorClass,
        abilities: abilityIds,
        equipment: {
            weapon: creation.selectedWeapon || null,
            armor: creation.selectedArmor || null,
            accessory: null
        },
        inventory: [
            { id: 'health_potion_small', name: 'Small Health Potion', type: 'consumable', effect: { type: 'heal', amount: '1d8+2' }, quantity: 2 }
        ],
        gold: 50 + Math.floor(Math.random() * 50),
        createdAt: Date.now(),
        lastPlayed: Date.now(),
        dungeonsCompleted: 0,
        monstersSlain: 0,
        pendingStatPoints: 0
    };

    await saveCharacter(guildId, odiscordUserId, character);
    return character;
}

// Helper functions
function getStartingWeaponsForClass(classId, items) {
    const classWeapons = {
        fighter: ['longsword', 'greatsword', 'battleaxe', 'warhammer'],
        rogue: ['shortsword', 'dagger', 'rapier', 'shortbow'],
        cleric: ['mace', 'warhammer', 'morningstar'],
        wizard: ['quarterstaff', 'dagger', 'light_crossbow'],
        ranger: ['longbow', 'shortsword', 'shortbow', 'handaxe'],
        barbarian: ['greataxe', 'greatsword', 'handaxe', 'battleaxe']
    };

    const allowed = classWeapons[classId] || ['dagger'];
    return items.weapons.filter(w => allowed.includes(w.id));
}

function getStartingArmorForClass(classId, items) {
    const classArmor = {
        fighter: ['leather_armor', 'chain_shirt', 'scale_mail'],
        rogue: ['leather_armor', 'padded_armor'],
        cleric: ['leather_armor', 'chain_shirt', 'scale_mail'],
        wizard: ['robes', 'padded_armor'],
        ranger: ['leather_armor', 'hide_armor'],
        barbarian: ['hide_armor', 'leather_armor']
    };

    const allowed = classArmor[classId] || ['robes'];
    return items.armor.filter(a => allowed.includes(a.id));
}

function formatStats(stats) {
    return `STR ${stats.strength} | DEX ${stats.dexterity} | CON ${stats.constitution} | INT ${stats.intelligence} | WIS ${stats.wisdom} | CHA ${stats.charisma}`;
}

// Legacy function for compatibility
async function createCharacter(guildId, odiscordUserId, name, raceId, classId) {
    const creation = {
        race: raceId,
        class: classId,
        stats: rollAbilityScores().reduce((acc, val, i) => {
            const names = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
            acc[names[i]] = val;
            return acc;
        }, {}),
        selectedWeapon: null,
        selectedArmor: null
    };
    return createCharacterFromCreation(guildId, odiscordUserId, name, creation);
}

function hasPendingCreation(guildId, odiscordUserId) {
    return pendingCreations.has(`${guildId}-${odiscordUserId}`);
}

function getPendingCreation(guildId, odiscordUserId) {
    return pendingCreations.get(`${guildId}-${odiscordUserId}`);
}

module.exports = {
    handleCreate,
    handleRaceSelection,
    handleClassSelection,
    handleStatMethodSelection,
    handlePointBuyChange,
    handlePointBuyMore,
    handleStatAssignment,
    handleGearSelection,
    showPointBuyInterface,
    showStatAssignment,
    createCharacter,
    createCharacterFromCreation,
    hasPendingCreation,
    getPendingCreation,
    pendingCreations
};
