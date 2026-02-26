const {
    handleRaceSelection,
    handleClassSelection,
    handleStatMethodSelection,
    handlePointBuyChange,
    handlePointBuyMore,
    handleStatAssignment,
    handleGearSelection,
    pendingCreations
} = require('../commands/create');
const { getSessionByMessageId, getSessionById } = require('../../utils/crawlState');
const { MessageFlags } = require('discord.js');

/**
 * Helper to update the main dungeon message (non-ephemeral shared message)
 * @param {Interaction} interaction - The interaction (to get channel)
 * @param {object} session - The dungeon session with messageId
 * @param {EmbedBuilder} embed - The embed to show
 * @param {ActionRowBuilder[]} components - The button rows
 */
async function updateMainMessage(interaction, session, embed, components) {
    if (!session.messageId) {
        console.error('No messageId in session for main message update');
        return;
    }

    try {
        const channel = interaction.channel;
        const message = await channel.messages.fetch(session.messageId);
        await message.edit({ embeds: [embed], components: components || [] });
    } catch (error) {
        console.error('Failed to update main message:', error.message);
    }
}


/**
 * Main interaction handler for crawl-related button/menu interactions
 * @param {Interaction} interaction
 */
async function handleCrawlInteraction(interaction) {
    // Parse the custom ID: crawl_action_userId_...params
    const parts = interaction.customId.split('_');

    if (parts[0] !== 'crawl') {
        return; // Not a crawl interaction
    }

    const action = parts[1];

    try {
        switch (action) {
            // Character creation - Race
            case 'race':
                await handleRaceButton(interaction, parts);
                break;

            // Character creation - Class
            case 'class':
                await handleClassButton(interaction, parts);
                break;

            // Character creation - Stat Method
            case 'statmethod':
                await handleStatMethodButton(interaction, parts);
                break;

            // Character creation - Point Buy
            case 'pointbuy':
                await handlePointBuyInteraction(interaction, parts);
                break;

            case 'pointbuystat':
                await handlePointBuyStatSelect(interaction, parts);
                break;

            case 'pointbuyval':
                await handlePointBuyValSelect(interaction, parts);
                break;

            // Character creation - Standard Array Assignment
            case 'assignstat':
                if (interaction.isStringSelectMenu()) {
                    const odiscordUserId = parts[2];
                    const statName = interaction.values[0];
                    await handleStatAssignment(interaction, odiscordUserId, statName, null);
                }
                break;

            case 'assignvalue':
                if (interaction.isStringSelectMenu()) {
                    const odiscordUserId = parts[2];
                    const value = interaction.values[0];
                    await handleStatAssignment(interaction, odiscordUserId, null, value);
                }
                break;

            case 'assignconfirm':
                await handleAssignConfirm(interaction, parts);
                break;

            // Character creation - Gear Selection
            case 'gear':
                if (interaction.isStringSelectMenu()) {
                    const gearType = parts[2]; // weapon or armor
                    const odiscordUserId = parts[3];
                    const gearId = interaction.values[0];
                    await handleGearSelection(interaction, odiscordUserId, gearType, gearId);
                }
                break;

            case 'gearback':
                await handleGearBack(interaction, parts);
                break;

            // Combat actions - Action Menu (opens ephemeral)
            case 'actionmenu':
                await handleActionMenu(interaction, parts);
                break;

            case 'attack':
                await handleAttackAction(interaction, parts);
                break;

            case 'attacktarget':
                await handleAttackTarget(interaction, parts);
                break;

            case 'defend':
                await handleDefendAction(interaction, parts);
                break;

            case 'item':
                await handleItemSelect(interaction, parts);
                break;

            case 'ability':
                await handleAbilitySelect(interaction, parts);
                break;

            case 'move':
                await handleMoveAction(interaction, parts);
                break;

            case 'moveselect':
                await handleMoveSelect(interaction, parts);
                break;

            case 'useitem':
                await handleItemUse(interaction, parts);
                break;

            case 'useability':
                await handleAbilityUse(interaction, parts);
                break;

            case 'itemtarget':
                await handleItemTarget(interaction, parts);
                break;

            case 'abilitytarget':
                await handleAbilityTarget(interaction, parts);
                break;

            case 'target':
                await handleTargetSelect(interaction, parts);
                break;

            case 'proceed':
                await handleProceed(interaction, parts);
                break;

            case 'retreat':
                await handleRetreat(interaction, parts);
                break;

            case 'inventory':
                await handleInventory(interaction, parts);
                break;

            case 'partyinv':
                await handlePartyInventory(interaction, parts);
                break;

            case 'equip':
                await handleEquip(interaction, parts);
                break;

            case 'useoutside':
                await handleUseOutsideCombat(interaction, parts);
                break;

            case 'backtodungeon':
                await handleBackToDungeon(interaction, parts);
                break;

            case 'closeinv':
                // Just dismiss the ephemeral inventory
                await interaction.update({ content: 'Inventory closed.', embeds: [], components: [] });
                break;

            case 'startdungeon':
                await handleStartDungeon(interaction, parts);
                break;

            case 'ready':
                await handleReady(interaction, parts);
                break;

            case 'cancelaction':
                await handleCancelAction(interaction, parts);
                break;

            // Stat point allocation
            case 'statpoint1':
            case 'statpoint2':
                await handleStatPointSelect(interaction, parts);
                break;

            // Inventory outside dungeon
            case 'invequip':
                await handleInvEquip(interaction, parts);
                break;

            case 'invuse':
                await handleInvUse(interaction, parts);
                break;

            // Party interactions
            case 'partyjoin':
                await handlePartyJoin(interaction, parts);
                break;

            case 'partydecline':
                await handlePartyDecline(interaction, parts);
                break;

            // Generic cancel
            case 'cancel':
                await handleCancelButton(interaction, parts);
                break;

            // Confirmations
            case 'confirm':
                await handleConfirmButton(interaction, parts);
                break;

            // Shop interactions
            case 'shopcategory':
                await handleShopCategory(interaction, parts);
                break;

            case 'shopbuy':
                await handleShopBuy(interaction, parts);
                break;

            case 'shopconfirm':
                await handleShopConfirm(interaction, parts);
                break;

            case 'shopcategoryback':
                await handleShopCategoryBack(interaction, parts);
                break;

            case 'shopback':
                await handleShopBack(interaction, parts);
                break;

            case 'shopsell':
                await handleShopSellMenu(interaction, parts);
                break;

            case 'shopsellselect':
                await handleShopSellSelect(interaction, parts);
                break;

            case 'shopsellconfirm':
                await handleShopSellConfirm(interaction, parts);
                break;

            case 'shopsellback':
                await handleShopSellBack(interaction, parts);
                break;

            case 'shopclose':
                await handleShopClose(interaction, parts);
                break;

            // Ability interactions
            case 'abilityview':
                await handleAbilityView(interaction, parts);
                break;

            case 'abilitylist':
                await handleAbilityList(interaction, parts);
                break;

            case 'abilityclose':
                await handleAbilityClose(interaction, parts);
                break;

            default:
                console.log(`Unknown crawl interaction: ${action}`, interaction.customId);
                await interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        console.error('Error handling crawl interaction:', error);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'An error occurred. Please try again.', flags: MessageFlags.Ephemeral });
            }
        } catch (e) {
            // Ignore if we can't respond
        }
    }
}

// Character creation handlers
async function handleRaceButton(interaction, parts) {
    // Format: crawl_race_userId_raceId
    const odiscordUserId = parts[2];
    const raceId = parts[3];
    await handleRaceSelection(interaction, odiscordUserId, raceId);
}

async function handleClassButton(interaction, parts) {
    // Format: crawl_class_userId_raceId_classId
    const odiscordUserId = parts[2];
    const raceId = parts[3];
    const classId = parts[4];
    await handleClassSelection(interaction, odiscordUserId, raceId, classId);
}

async function handleStatMethodButton(interaction, parts) {
    // Format: crawl_statmethod_userId_method
    const odiscordUserId = parts[2];
    const method = parts[3]; // random, pointbuy, standard
    await handleStatMethodSelection(interaction, odiscordUserId, method);
}

async function handlePointBuyInteraction(interaction, parts) {
    // Various point buy interactions
    const subAction = parts[2];

    if (interaction.isStringSelectMenu()) {
        // Format: crawl_pointbuy_userId_statName (from select menu)
        const odiscordUserId = parts[2];
        const statName = parts[3];
        const value = interaction.values[0];
        await handlePointBuyChange(interaction, odiscordUserId, statName, value);
        return;
    }

    // Button interactions
    if (subAction === 'more') {
        // Format: crawl_pointbuy_more_userId
        const odiscordUserId = parts[3];
        await handlePointBuyMore(interaction, odiscordUserId);
        return;
    }

    if (subAction === 'back') {
        // Format: crawl_pointbuy_back_userId - go back to physical stats
        const odiscordUserId = parts[3];
        const guildId = interaction.guild.id;
        const key = `${guildId}-${odiscordUserId}`;
        const creation = pendingCreations.get(key);

        if (!creation) {
            return interaction.reply({ content: 'Character creation expired.', flags: MessageFlags.Ephemeral });
        }

        // Show physical stats again
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
        const stats = creation.stats;
        const pointsRemaining = creation.pointsRemaining;

        const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8 };

        const embed = new EmbedBuilder()
            .setColor(0x7B2D26)
            .setTitle('Point Buy - Physical Stats')
            .setDescription(`**Points Remaining: ${pointsRemaining}**`)
            .addFields(
                { name: 'STR', value: `${stats.strength}`, inline: true },
                { name: 'DEX', value: `${stats.dexterity}`, inline: true },
                { name: 'CON', value: `${stats.constitution}`, inline: true },
                { name: 'INT', value: `${stats.intelligence}`, inline: true },
                { name: 'WIS', value: `${stats.wisdom}`, inline: true },
                { name: 'CHA', value: `${stats.charisma}`, inline: true }
            )
            .setFooter({ text: 'Cost: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=6, 15=8' });

        const rows = [];
        const physicalStats = ['strength', 'dexterity', 'constitution'];
        const physicalLabels = ['STR', 'DEX', 'CON'];

        for (let i = 0; i < 3; i++) {
            const currentValue = stats[physicalStats[i]];
            const statOptions = [8, 9, 10, 11, 12, 13, 14, 15].map(val => ({
                label: `${val} (${POINT_BUY_COSTS[val]} pts)`,
                value: val.toString(),
                default: val === currentValue
            }));

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_pointbuy_${odiscordUserId}_${physicalStats[i]}`)
                .setPlaceholder(`${physicalLabels[i]}: ${currentValue}`)
                .addOptions(statOptions);
            rows.push(new ActionRowBuilder().addComponents(menu));
        }

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_pointbuy_more_${odiscordUserId}`)
                .setLabel('More Stats (INT/WIS/CHA)')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`crawl_pointbuy_confirm_${odiscordUserId}`)
                .setLabel('Confirm Stats')
                .setStyle(ButtonStyle.Success)
                .setDisabled(pointsRemaining < 0)
        );
        rows.push(confirmRow);

        await interaction.update({ embeds: [embed], components: rows });
        return;
    }

    if (subAction === 'confirm') {
        // Format: crawl_pointbuy_confirm_userId
        const odiscordUserId = parts[3];
        await handlePointBuyConfirm(interaction, odiscordUserId);
        return;
    }
}

async function handlePointBuyStatSelect(interaction, parts) {
    // Format: crawl_pointbuystat_userId - user picked which stat to change
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;
    const creation = pendingCreations.get(key);

    if (!creation || creation.step !== 'point_buy') {
        return interaction.reply({ content: 'Character creation expired.', flags: MessageFlags.Ephemeral });
    }

    // Store which stat is selected
    creation.selectedPointBuyStat = interaction.values[0];

    const { showPointBuyInterface } = require('../commands/create');
    await showPointBuyInterface(interaction, creation, odiscordUserId);
}

async function handlePointBuyValSelect(interaction, parts) {
    // Format: crawl_pointbuyval_userId - user picked the new value for the selected stat
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;
    const creation = pendingCreations.get(key);

    if (!creation || creation.step !== 'point_buy') {
        return interaction.reply({ content: 'Character creation expired.', flags: MessageFlags.Ephemeral });
    }

    const selectedStat = creation.selectedPointBuyStat;
    if (!selectedStat) {
        return interaction.reply({ content: 'Please select a stat first!', flags: MessageFlags.Ephemeral });
    }

    const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8 };
    const newValue = parseInt(interaction.values[0]);
    const oldValue = creation.stats[selectedStat];
    const oldCost = POINT_BUY_COSTS[oldValue];
    const newCost = POINT_BUY_COSTS[newValue];

    creation.pointsRemaining += oldCost - newCost;
    creation.stats[selectedStat] = newValue;

    const { showPointBuyInterface } = require('../commands/create');
    await showPointBuyInterface(interaction, creation, odiscordUserId);
}

async function handlePointBuyConfirm(interaction, odiscordUserId) {
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;
    const creation = pendingCreations.get(key);

    if (!creation || creation.pointsRemaining < 0) {
        return interaction.reply({ content: 'Invalid point allocation or session expired.', flags: MessageFlags.Ephemeral });
    }

    // Move to gear selection
    await moveToGearSelection(interaction, creation, odiscordUserId);
}

async function handleAssignConfirm(interaction, parts) {
    // Format: crawl_assignconfirm_userId
    const odiscordUserId = parts[2];
    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;
    const creation = pendingCreations.get(key);

    if (!creation) {
        return interaction.reply({ content: 'Character creation expired.', flags: MessageFlags.Ephemeral });
    }

    // Move to gear selection
    await moveToGearSelection(interaction, creation, odiscordUserId);
}

async function moveToGearSelection(interaction, creation, odiscordUserId) {
    creation.step = 'gear';

    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const { getClass } = require('../character/classes');
    const items = require('../../data/items.json');

    const cls = getClass(creation.class);

    const classWeapons = {
        fighter: ['longsword', 'greatsword', 'battleaxe', 'warhammer'],
        rogue: ['shortsword', 'dagger', 'rapier', 'shortbow'],
        cleric: ['mace', 'warhammer', 'morningstar'],
        wizard: ['quarterstaff', 'dagger', 'light_crossbow'],
        ranger: ['longbow', 'shortsword', 'shortbow', 'handaxe'],
        barbarian: ['greataxe', 'greatsword', 'handaxe', 'battleaxe']
    };

    const classArmor = {
        fighter: ['leather_armor', 'chain_shirt', 'scale_mail'],
        rogue: ['leather_armor', 'padded_armor'],
        cleric: ['leather_armor', 'chain_shirt', 'scale_mail'],
        wizard: ['robes', 'padded_armor'],
        ranger: ['leather_armor', 'hide_armor'],
        barbarian: ['hide_armor', 'leather_armor']
    };

    const allowedWeapons = classWeapons[creation.class] || ['dagger'];
    const allowedArmor = classArmor[creation.class] || ['robes'];

    const weaponOptions = items.weapons.filter(w => allowedWeapons.includes(w.id));
    const armorOptions = items.armor.filter(a => allowedArmor.includes(a.id));

    creation.gearOptions = { weapons: weaponOptions, armor: armorOptions };

    const stats = creation.stats;
    const embed = new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Choose Starting Equipment')
        .setDescription(`As a **${cls.name}**, select your starting weapon and armor.`)
        .addFields(
            { name: 'Stats', value: `STR ${stats.strength} | DEX ${stats.dexterity} | CON ${stats.constitution} | INT ${stats.intelligence} | WIS ${stats.wisdom} | CHA ${stats.charisma}`, inline: false }
        );

    const rows = [];

    if (weaponOptions.length > 0) {
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

    if (armorOptions.length > 0) {
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

    // Back button to go back to stat allocation
    const { ButtonBuilder, ButtonStyle } = require('discord.js');
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_gearback_${odiscordUserId}`)
            .setLabel('Back to Stats')
            .setStyle(ButtonStyle.Secondary)
    );
    rows.push(backRow);

    await interaction.update({ embeds: [embed], components: rows });
}

async function handleGearBack(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your character creation!', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guild.id;
    const key = `${guildId}-${odiscordUserId}`;
    const creation = pendingCreations.get(key);

    if (!creation) {
        return interaction.reply({ content: 'Character creation expired.', flags: MessageFlags.Ephemeral });
    }

    // Go back to stat allocation based on the method used
    if (creation.statMethod === 'pointbuy') {
        creation.step = 'point_buy';
        const { showPointBuyInterface } = require('../commands/create');
        await showPointBuyInterface(interaction, creation, odiscordUserId);
    } else if (creation.statMethod === 'standard') {
        creation.step = 'assign_stats';
        const allStats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        // Rebuild the standard array from assigned stats
        const assignedValues = allStats.filter(s => creation.stats[s]).map(s => creation.stats[s]);
        const fullArray = [15, 14, 13, 12, 10, 8];
        creation.standardArray = fullArray.filter(v => !assignedValues.includes(v));
        const { showStatAssignment } = require('../commands/create');
        await showStatAssignment(interaction, creation, odiscordUserId);
    } else {
        // Random roll - can't really go back, just inform
        await interaction.reply({ content: 'Stats were randomly rolled - cannot go back.', flags: MessageFlags.Ephemeral });
    }
}

async function handleCancelButton(interaction, parts) {
    const odiscordUserId = parts[2];
    const guildId = interaction.guild.id;

    // Clean up pending character creation if exists
    pendingCreations.delete(`${guildId}-${odiscordUserId}`);

    // Clean up dungeon session if exists (for cancelling dungeon entry)
    const { getSession, deleteSession } = require('../../utils/crawlState');
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (session) {
        // Clean up sessions for all party members
        if (session.isParty && session.partyMemberIds) {
            for (const memberId of session.partyMemberIds) {
                deleteSession(guildId, memberId);
            }
        } else {
            deleteSession(guildId, odiscordUserId);
        }
    }

    await interaction.update({
        content: 'Action cancelled.',
        embeds: [],
        components: []
    });
}

async function handleConfirmButton(interaction, parts) {
    const sessionId = parts[2];
    const confirmAction = parts[3];
    // TODO: Handle specific confirmations
    await interaction.reply({ content: 'Confirmed!', flags: MessageFlags.Ephemeral });
}

// ============================================
// Combat Handlers
// ============================================

/**
 * Opens the ephemeral action menu with Attack/Defend/Item/Ability buttons
 */
async function handleActionMenu(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { getAvailableActions } = require('../combat/actions');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.reply({ content: 'No active combat.', flags: MessageFlags.Ephemeral });
    }

    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const hasItems = player?.inventory?.some(i => i.type === 'consumable');

    // Check for ready abilities
    const actions = getAvailableActions(session, odiscordUserId);
    const hasReadyAbilities = actions.abilities.some(a => a.ready);

    // Check movement remaining
    const movementLeft = player?.movementRemaining ?? 6;
    const canMove = movementLeft > 0;

    // Build the action menu embed
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`⚔️ ${player?.name || 'Your'}'s Turn`)
        .setDescription('Choose your action:')
        .addFields(
            { name: '⚔️ Attack', value: 'Strike an enemy with your weapon', inline: true },
            { name: '🛡️ Defend', value: '+2 AC, 50% damage reduction', inline: true },
            { name: '🧪 Item', value: hasItems ? 'Use a consumable item' : '*No items*', inline: true },
            { name: '✨ Ability', value: hasReadyAbilities ? 'Use a class ability' : '*On cooldown*', inline: true },
            { name: '🏃 Move', value: canMove ? `${movementLeft} squares remaining` : '*No movement left*', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_attack_${odiscordUserId}`)
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_defend_${odiscordUserId}`)
            .setLabel('Defend')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId(`crawl_move_${odiscordUserId}`)
            .setLabel('Move')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏃')
            .setDisabled(!canMove),
        new ButtonBuilder()
            .setCustomId(`crawl_item_${odiscordUserId}`)
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧪')
            .setDisabled(!hasItems),
        new ButtonBuilder()
            .setCustomId(`crawl_ability_${odiscordUserId}`)
            .setLabel('Use Ability')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✨')
            .setDisabled(!hasReadyAbilities)
    );

    // Reply with ephemeral action menu
    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}

async function handleStartDungeon(interaction, parts) {
    const odiscordUserId = parts[2];
    const { getSession, updateSession } = require('../../utils/crawlState');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    const session = getSession(guildId, odiscordUserId);

    if (!session) {
        return interaction.reply({ content: 'No active dungeon session.', flags: MessageFlags.Ephemeral });
    }

    // For party dungeon, show ready check
    if (session.isParty && session.characters.length > 1) {
        // Initialize ready check if not exists
        if (!session.readyCheck) {
            session.readyCheck = {};
        }

        // Mark the clicker as ready
        session.readyCheck[interaction.user.id] = true;
        updateSession(guildId, odiscordUserId, session);

        // Check if all party members are ready
        const allReady = session.characters.every(c => session.readyCheck[c.odiscordUserId]);

        if (allReady) {
            // Everyone ready - enter dungeon!
            session.readyCheck = null; // Clear for next room
            updateSession(guildId, odiscordUserId, session);
            const { enterDungeon } = require('../commands/start');
            return enterDungeon(interaction, odiscordUserId);
        }

        // Show ready check status
        const readyStatus = session.characters.map(c => {
            const isReady = session.readyCheck[c.odiscordUserId];
            return `${isReady ? '✅' : '⏳'} **${c.name}**`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('⚔️ Ready Check')
            .setDescription(`Waiting for all party members to ready up!\n\n${readyStatus}`)
            .setFooter({ text: 'All members must click Ready to enter the dungeon' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_ready_${odiscordUserId}_enter`)
                .setLabel('Ready!')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // Solo or already verified - enter dungeon
    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your dungeon!', flags: MessageFlags.Ephemeral });
    }

    const { enterDungeon } = require('../commands/start');
    await enterDungeon(interaction, odiscordUserId);
}

async function handleAttackAction(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { getAliveMonsters } = require('../combat/combatManager');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    // Get alive monsters
    const aliveMonsters = getAliveMonsters(session.combat);

    // If only one monster, attack directly (defer and execute)
    if (aliveMonsters.length === 1) {
        await interaction.deferUpdate();
        return executeAttackOnTarget(interaction, session, odiscordUserId, aliveMonsters[0].id);
    }

    // Multiple monsters - update ephemeral with target selection
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚔️ Choose Your Target')
        .setDescription('Select an enemy to attack:')
        .addFields(
            aliveMonsters.map(m => {
                const hp = m.combatHp !== undefined ? m.combatHp : m.currentHp;
                return { name: m.name, value: `HP: ${hp}/${m.maxHp}`, inline: true };
            })
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_attacktarget_${odiscordUserId}`)
        .setPlaceholder('Choose an enemy to attack')
        .addOptions(aliveMonsters.map(m => {
            const hp = m.combatHp !== undefined ? m.combatHp : m.currentHp;
            return {
                label: m.name,
                description: `HP: ${hp}/${m.maxHp}`,
                value: m.id
            };
        }));

    const menuRow = new ActionRowBuilder().addComponents(menu);
    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_cancelaction_${odiscordUserId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    // Update the ephemeral with target selection
    await interaction.update({ embeds: [embed], components: [menuRow, cancelRow] });
}

async function executeAttackOnTarget(interaction, session, odiscordUserId, targetId) {
    const { updateSession, getSession } = require('../../utils/crawlState');
    const { executeAttack } = require('../combat/actions');
    const { createCombatEmbed, createCombatButtons, createProceedButtons, handleDefeat } = require('../commands/start');
    const { getCombatRewards, processMonsterTurn, endTurn, resolveCombatEnd, getCurrentCombatant } = require('../combat/combatManager');
    const { getCurrentRoom, clearRoom } = require('../dungeon/generator');
    const { EmbedBuilder } = require('discord.js');

    const guildId = interaction.guild.id;

    // For party members, get the leader's session
    let actualSession = session;
    if (session?.linkedTo) {
        actualSession = getSession(guildId, session.linkedTo);
    }
    const leaderId = actualSession.isParty ? actualSession.odiscordUserId : actualSession.characters[0].odiscordUserId;

    // Execute attack on selected target
    const attackResult = await executeAttack(actualSession, odiscordUserId, targetId);

    if (!attackResult.success) {
        // Update ephemeral with error
        try {
            await interaction.editReply({ content: `❌ ${attackResult.message}`, embeds: [], components: [] });
        } catch {
            await interaction.followUp({ content: attackResult.message, flags: MessageFlags.Ephemeral });
        }
        return;
    }

    // Check if combat ended from the attack itself (killed last monster)
    if (attackResult.combatEnd?.ended) {
        return handleCombatEnd(interaction, actualSession, leaderId, guildId, attackResult.combatEnd.victory);
    }

    // Check if player has extra attack (Action Surge, Frenzy) - skip to their turn again
    const currentPlayer = actualSession.combat?.players.find(p => p.odiscordUserId === odiscordUserId);
    if (currentPlayer?.extraAttack) {
        currentPlayer.extraAttack = false;
        let embed = createCombatEmbed(actualSession);
        embed.setDescription(`**${currentPlayer.name}'s Bonus Action!**`);
        const buttons = createCombatButtons(odiscordUserId, actualSession);
        await updateMainMessage(interaction, actualSession, embed, buttons);
        updateSession(guildId, actualSession.odiscordUserId, actualSession);
        return;
    }

    // Update the main message with combat status
    let embed = createCombatEmbed(actualSession);
    embed.setDescription('**Enemies are responding...**');

    // Disable all buttons during monster turns
    const disabledRow = createDisabledButtons(odiscordUserId);
    await updateMainMessage(interaction, actualSession, embed, [disabledRow]);

    // Process monster turns with delays
    await processMonsterTurnsWithDelay(interaction, actualSession, leaderId, guildId, 1500, odiscordUserId);
}

async function handleAttackTarget(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const targetId = interaction.values[0];
    const { getSession } = require('../../utils/crawlState');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    // Defer the update on the ephemeral (we'll edit it later)
    await interaction.deferUpdate();

    await executeAttackOnTarget(interaction, session, odiscordUserId, targetId);
}

function createDisabledButtons(odiscordUserId) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_attack_${odiscordUserId}`)
            .setLabel('Attack')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`crawl_defend_${odiscordUserId}`)
            .setLabel('Defend')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`crawl_item_${odiscordUserId}`)
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`crawl_ability_${odiscordUserId}`)
            .setLabel('Use Ability')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );
}

async function processMonsterTurnsWithDelay(interaction, session, leaderId, guildId, delayMs, actingPlayerId = null) {
    const { updateSession } = require('../../utils/crawlState');
    const { processMonsterTurn, endTurn, resolveCombatEnd, getCurrentCombatant } = require('../combat/combatManager');
    const { createCombatEmbed, createCombatButtons, createProceedButtons, handleDefeat } = require('../commands/start');
    const { getAvailableActions } = require('../combat/actions');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const combat = session.combat;

    // End player's turn first
    let turnResult = endTurn(combat);
    if (turnResult.ended) {
        const combatEnd = resolveCombatEnd(combat);
        return handleCombatEnd(interaction, session, leaderId, guildId, combatEnd.victory);
    }

    // Update ephemeral to show waiting status
    try {
        await interaction.editReply({ content: '⏳ Enemies are responding...', embeds: [], components: [] });
    } catch (e) {
        // Ephemeral may already be dismissed
    }

    // Process each monster turn with delay
    while (true) {
        const currentCombatant = getCurrentCombatant(combat);
        if (!currentCombatant) break;

        // Check if combat ended
        const combatEnd = resolveCombatEnd(combat);
        if (combatEnd.ended) {
            return handleCombatEnd(interaction, session, leaderId, guildId, combatEnd.victory);
        }

        // If it's a player's turn, check if stunned first
        if (currentCombatant.odiscordUserId) {
            if (currentCombatant.conditions?.some(c => c.name === 'stunned')) {
                // Stunned player - skip their turn
                await sleep(delayMs);
                combat.log.push(`**${currentCombatant.name}** is **stunned** and loses their turn!`);
                let embed = createCombatEmbed(session);
                embed.setDescription(`**${currentCombatant.name} is stunned!**`);
                const disabledRow = createDisabledButtons(leaderId);
                await updateMainMessage(interaction, session, embed, [disabledRow]);
                turnResult = endTurn(combat);
                if (turnResult.ended) {
                    const combatEnd = resolveCombatEnd(combat);
                    return handleCombatEnd(interaction, session, leaderId, guildId, combatEnd.victory);
                }
                continue; // Keep looping to next combatant
            }
            break;
        }

        // Wait before showing monster action
        await sleep(delayMs);

        // Process monster turn
        const monsterResult = processMonsterTurn(combat, currentCombatant);
        if (monsterResult) {
            combat.log.push(monsterResult.message);
        }

        // Update the main message to show the monster's action
        let embed = createCombatEmbed(session);
        embed.setDescription(`**${currentCombatant.name} attacks!**`);

        const disabledRow = createDisabledButtons(leaderId);
        await updateMainMessage(interaction, session, embed, [disabledRow]);

        // End monster turn
        turnResult = endTurn(combat);
        if (turnResult.ended) {
            const combatEnd = resolveCombatEnd(combat);
            return handleCombatEnd(interaction, session, leaderId, guildId, combatEnd.victory);
        }
    }

    // All monster turns done, figure out which player's turn it is
    const nextCombatant = getCurrentCombatant(combat);
    const nextPlayerId = nextCombatant?.odiscordUserId || leaderId;

    await sleep(500); // Short delay before enabling buttons

    updateSession(guildId, leaderId, session);
    const mainEmbed = createCombatEmbed(session);

    // Check if the same player gets another turn - reuse their ephemeral
    if (actingPlayerId && nextPlayerId === actingPlayerId) {
        // Same player's turn again - update their ephemeral with action menu
        const player = combat.players.find(p => p.odiscordUserId === nextPlayerId);
        const hasItems = player?.inventory?.some(i => i.type === 'consumable');
        const actions = getAvailableActions(session, nextPlayerId);
        const hasReadyAbilities = actions.abilities.some(a => a.ready);

        const movementLeft = player?.movementRemaining ?? 6;
        const canMove = movementLeft > 0;

        const actionEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`⚔️ ${player?.name || 'Your'}'s Turn`)
            .setDescription('Choose your action:')
            .addFields(
                { name: '⚔️ Attack', value: 'Strike an enemy', inline: true },
                { name: '🛡️ Defend', value: '+2 AC, 50% dmg reduction', inline: true },
                { name: '🧪 Item', value: hasItems ? 'Use item' : '*No items*', inline: true },
                { name: '✨ Ability', value: hasReadyAbilities ? 'Use ability' : '*On cooldown*', inline: true },
                { name: '🏃 Move', value: canMove ? `${movementLeft} sq left` : '*No movement*', inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_attack_${nextPlayerId}`)
                .setLabel('Attack')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚔️'),
            new ButtonBuilder()
                .setCustomId(`crawl_defend_${nextPlayerId}`)
                .setLabel('Defend')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🛡️'),
            new ButtonBuilder()
                .setCustomId(`crawl_move_${nextPlayerId}`)
                .setLabel('Move')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏃')
                .setDisabled(!canMove),
            new ButtonBuilder()
                .setCustomId(`crawl_item_${nextPlayerId}`)
                .setLabel('Use Item')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🧪')
                .setDisabled(!hasItems),
            new ButtonBuilder()
                .setCustomId(`crawl_ability_${nextPlayerId}`)
                .setLabel('Use Ability')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✨')
                .setDisabled(!hasReadyAbilities)
        );

        // Update ephemeral with new action menu
        try {
            await interaction.editReply({ embeds: [actionEmbed], components: [row] });
        } catch (e) {
            // If editReply fails, fall back to main message button
        }

        // Update main message WITHOUT action button (player uses ephemeral)
        await updateMainMessage(interaction, session, mainEmbed, []);
    } else {
        // Different player's turn - dismiss current ephemeral, show button on main
        try {
            await interaction.editReply({
                content: `⏳ It's now **${nextCombatant?.name || 'another player'}'s** turn.`,
                embeds: [],
                components: []
            });
        } catch (e) {
            // Ephemeral may already be gone
        }

        const buttons = createCombatButtons(nextPlayerId, session);
        await updateMainMessage(interaction, session, mainEmbed, buttons);
    }
}

async function handleCombatEnd(interaction, session, leaderId, guildId, victory) {
    const { updateSession } = require('../../utils/crawlState');
    const { getCombatRewards } = require('../combat/combatManager');
    const { getCurrentRoom, clearRoom } = require('../dungeon/generator');
    const { createProceedButtons, handleDefeat, addItemToInventory } = require('../commands/start');
    const { EmbedBuilder } = require('discord.js');

    // Dismiss the ephemeral action menu
    try {
        await interaction.editReply({ content: '⚔️ Combat ended!', embeds: [], components: [] });
    } catch (e) {
        // Ephemeral may already be dismissed
    }

    if (victory) {
        const rewards = getCombatRewards(session.combat);
        session.dungeon.rewards.totalXp += rewards.xp;
        session.dungeon.rewards.totalGold += rewards.gold;

        const room = getCurrentRoom(session.dungeon);
        clearRoom(session.dungeon);

        // Sync combat HP back to ALL party member characters
        const monstersSlain = session.combat.monsters.length;
        for (const character of session.characters) {
            const combatPlayer = session.combat.players.find(p => p.odiscordUserId === character.odiscordUserId);
            if (combatPlayer) {
                character.currentHp = combatPlayer.combatHp;
            }
            character.monstersSlain = (character.monstersSlain || 0) + monstersSlain;
        }

        // Distribute items randomly among party members
        for (const item of rewards.items) {
            const randomChar = session.characters[Math.floor(Math.random() * session.characters.length)];
            addItemToInventory(randomChar, item);
        }

        session.combat = null;
        session.status = 'exploring';
        updateSession(guildId, leaderId, session);

        // Build items display with type indicators
        let itemsText = 'None';
        if (rewards.items.length > 0) {
            itemsText = rewards.items.map(i => {
                if (i.type === 'weapon') return `⚔️ ${i.name}`;
                if (i.type === 'armor') return `🛡️ ${i.name}`;
                if (i.type === 'accessory') return `💍 ${i.name}`;
                if (i.type === 'consumable') return `🧪 ${i.name}`;
                return i.name;
            }).join(', ');
        }

        const description = session.isParty
            ? `All enemies defeated in ${room.name}!` + (rewards.items.length > 0 ? '\n*Items distributed among party members!*' : '')
            : `All enemies defeated in ${room.name}!` + (rewards.items.length > 0 ? '\n*Items added to your inventory!*' : '');

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Victory!')
            .setDescription(description)
            .addFields(
                { name: 'XP Earned', value: `${rewards.xp}`, inline: true },
                { name: 'Gold Found', value: `${rewards.gold}`, inline: true },
                { name: 'Items', value: itemsText, inline: false }
            );

        const buttons = createProceedButtons(leaderId, session);

        // Update the main message with victory
        await updateMainMessage(interaction, session, embed, buttons);
    } else {
        await handleDefeat(interaction, session);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleDefendAction(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { executeDefend } = require('../combat/actions');
    const { createCombatEmbed } = require('../commands/start');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Execute defend
    await executeDefend(session, odiscordUserId);

    // Update the ephemeral to show confirmation (dismiss action menu)
    await interaction.update({ content: '🛡️ You take a defensive stance!', embeds: [], components: [] });

    // Update main message to show defend result
    let embed = createCombatEmbed(session);
    embed.setDescription('**Enemies are responding...**');

    const disabledRow = createDisabledButtons(odiscordUserId);
    await updateMainMessage(interaction, session, embed, [disabledRow]);

    // Process monster turns with delays
    await processMonsterTurnsWithDelay(interaction, session, leaderId, guildId, 1500, odiscordUserId);
}

async function handleItemSelect(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const consumables = player?.inventory?.filter(i => i.type === 'consumable') || [];

    if (consumables.length === 0) {
        return interaction.update({ content: 'You have no usable items!', embeds: [], components: [] });
    }

    // Update ephemeral with item selection
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🧪 Use Item')
        .setDescription('Select an item to use:')
        .addFields(
            consumables.slice(0, 10).map(item => ({
                name: `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`,
                value: item.description?.substring(0, 100) || 'A consumable item',
                inline: true
            }))
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_useitem_${odiscordUserId}`)
        .setPlaceholder('Select an item to use')
        .addOptions(consumables.map((item, idx) => ({
            label: `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`,
            description: item.description?.substring(0, 100) || 'A consumable item',
            value: `${item.id}_${idx}`
        })));

    const menuRow = new ActionRowBuilder().addComponents(menu);

    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_cancelaction_${odiscordUserId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    // Update the ephemeral with item selection
    await interaction.update({ embeds: [embed], components: [menuRow, cancelRow] });
}

async function handleItemUse(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const selectedValue = interaction.values[0];
    // Parse the value format: ${item.id}_${idx}
    const selectedIdx = parseInt(selectedValue.split('_').pop());

    const { getSession } = require('../../utils/crawlState');
    const { executeUseItem } = require('../combat/actions');
    const { createCombatEmbed } = require('../commands/start');
    const { getAlivePlayers } = require('../combat/combatManager');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Find the item using index (to handle duplicates)
    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const consumables = (player?.inventory || []).filter(i => i.type === 'consumable');
    const item = consumables[selectedIdx];

    // If it's a healing item and in a party, show target selection (including downed players)
    if (item?.effect?.type === 'heal' && session.isParty) {
        const { getDownedPlayers } = require('../combat/combatManager');
        const alivePlayers = getAlivePlayers(session.combat);
        const downedPlayers = getDownedPlayers(session.combat);
        const healTargets = [...alivePlayers, ...downedPlayers];

        if (healTargets.length > 1) {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle(`🧪 Using ${item.name}`)
                .setDescription('Select who to heal:')
                .addFields(
                    healTargets.map(p => {
                        const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
                        return { name: p.name, value: hp <= 0 ? 'HP: **DOWNED**' : `HP: ${hp}/${p.maxHp}`, inline: true };
                    })
                );

            const targetMenu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_itemtarget_${odiscordUserId}_${selectedIdx}`)
                .setPlaceholder('Select who to heal')
                .addOptions(healTargets.map(p => {
                    const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
                    return {
                        label: p.name,
                        description: hp <= 0 ? 'DOWNED' : `HP: ${hp}/${p.maxHp}`,
                        value: p.odiscordUserId,
                        emoji: hp <= 0 ? '💀' : (hp < p.maxHp ? '💔' : '❤️')
                    };
                }));

            const menuRow = new ActionRowBuilder().addComponents(targetMenu);
            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`crawl_cancelaction_${odiscordUserId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            // Update the ephemeral message with target selection
            return interaction.update({ embeds: [embed], components: [menuRow, cancelRow] });
        }
    }

    // No target selection needed, use item on self - defer first
    await interaction.deferUpdate();

    const result = await executeUseItem(session, odiscordUserId, item.id);

    if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}`, embeds: [], components: [] });
        return;
    }

    // Check if combat ended from item use
    if (result.combatEnd?.ended) {
        return handleCombatEnd(interaction, session, leaderId, guildId, result.combatEnd.victory);
    }

    // Update main message
    let embed = createCombatEmbed(session);
    embed.setDescription('**Enemies are responding...**');

    const disabledRow = createDisabledButtons(odiscordUserId);
    await updateMainMessage(interaction, session, embed, [disabledRow]);

    // Process monster turns with delays
    await processMonsterTurnsWithDelay(interaction, session, leaderId, guildId, 1500, odiscordUserId);
}

async function handleItemTarget(interaction, parts) {
    // Format: crawl_itemtarget_userId_selectedIdx
    const odiscordUserId = parts[2];
    const selectedIdx = parseInt(parts[3]);

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const targetId = interaction.values[0];
    const { getSession } = require('../../utils/crawlState');
    const { executeUseItem } = require('../combat/actions');
    const { createCombatEmbed } = require('../commands/start');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Find the item by index
    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const consumables = (player?.inventory || []).filter(i => i.type === 'consumable');
    const item = consumables[selectedIdx];

    if (!item) {
        return interaction.update({ content: 'Item not found.', embeds: [], components: [] });
    }

    // Defer the update on ephemeral
    await interaction.deferUpdate();

    // Execute use item with the selected target
    const result = await executeUseItem(session, odiscordUserId, item.id, targetId);

    // Get target name for feedback
    const target = session.combat.players.find(p => p.odiscordUserId === targetId);
    const targetName = target?.name || 'ally';

    if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}`, embeds: [], components: [] });
        return;
    }

    // Check if combat ended from item use
    if (result.combatEnd?.ended) {
        return handleCombatEnd(interaction, session, leaderId, guildId, result.combatEnd.victory);
    }

    // Update main message
    let embed = createCombatEmbed(session);
    embed.setDescription('**Enemies are responding...**');

    const disabledRow = createDisabledButtons(odiscordUserId);
    await updateMainMessage(interaction, session, embed, [disabledRow]);

    // Process monster turns with delays
    await processMonsterTurnsWithDelay(interaction, session, leaderId, guildId, 1500, odiscordUserId);
}

async function handleAbilitySelect(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { getAvailableActions } = require('../combat/actions');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const actions = getAvailableActions(session, odiscordUserId);
    const readyAbilities = actions.abilities.filter(a => a.ready);

    if (readyAbilities.length === 0) {
        return interaction.update({ content: 'All abilities are on cooldown!', embeds: [], components: [] });
    }

    // Update ephemeral with ability selection
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('✨ Use Ability')
        .setDescription('Select an ability to use:')
        .addFields(
            readyAbilities.slice(0, 10).map(ability => ({
                name: ability.name,
                value: ability.description?.substring(0, 100) || 'An ability',
                inline: true
            }))
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_useability_${odiscordUserId}`)
        .setPlaceholder('Select an ability to use')
        .addOptions(readyAbilities.map(ability => ({
            label: ability.name,
            description: ability.description?.substring(0, 100) || 'An ability',
            value: ability.id
        })));

    const menuRow = new ActionRowBuilder().addComponents(menu);

    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_cancelaction_${odiscordUserId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    // Update the ephemeral with ability selection
    await interaction.update({ embeds: [embed], components: [menuRow, cancelRow] });
}

async function handleAbilityUse(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const abilityId = interaction.values[0];
    const { getSession } = require('../../utils/crawlState');
    const { executeUseAbility } = require('../combat/actions');
    const { createCombatEmbed } = require('../commands/start');
    const { getAlivePlayers, getDownedPlayers } = require('../combat/combatManager');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Check if this is a healing ability and we're in a party
    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const abilities = require('../../data/abilities.json');
    const classAbilities = abilities[player?.class] || {};
    const ability = classAbilities[abilityId];

    // If it's a healing/revive ability and in a party, show target selection
    if ((ability?.type === 'heal' || ability?.type === 'revive') && session.isParty) {
        // For heal: show alive + downed players; for revive: show only downed
        const alivePlayers = getAlivePlayers(session.combat);
        const downedPlayers = getDownedPlayers(session.combat);
        const healTargets = ability.type === 'revive' ? downedPlayers : [...alivePlayers, ...downedPlayers];
        // Remove duplicates (alive and downed shouldn't overlap, but just in case)
        const uniqueTargets = [...new Map(healTargets.map(p => [p.odiscordUserId, p])).values()];

        if (uniqueTargets.length > 1 || (ability.type === 'revive' && uniqueTargets.length > 0)) {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle(`✨ Using ${ability.name}`)
                .setDescription(ability.type === 'revive' ? 'Select who to revive:' : 'Select who to heal:')
                .addFields(
                    uniqueTargets.map(p => {
                        const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
                        return { name: p.name, value: hp <= 0 ? `HP: **DOWNED**` : `HP: ${hp}/${p.maxHp}`, inline: true };
                    })
                );

            const targetMenu = new StringSelectMenuBuilder()
                .setCustomId(`crawl_abilitytarget_${odiscordUserId}_${abilityId}`)
                .setPlaceholder(ability.type === 'revive' ? 'Select who to revive' : 'Select who to heal')
                .addOptions(uniqueTargets.map(p => {
                    const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
                    return {
                        label: p.name,
                        description: hp <= 0 ? 'DOWNED' : `HP: ${hp}/${p.maxHp}`,
                        value: p.odiscordUserId,
                        emoji: hp <= 0 ? '💀' : (hp < p.maxHp ? '💔' : '❤️')
                    };
                }));

            const menuRow = new ActionRowBuilder().addComponents(targetMenu);
            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`crawl_cancelaction_${odiscordUserId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            // Update the ephemeral with target selection
            return interaction.update({ embeds: [embed], components: [menuRow, cancelRow] });
        }
    }

    // No target selection needed - defer first
    await interaction.deferUpdate();

    const result = await executeUseAbility(session, odiscordUserId, abilityId);

    if (!result.success) {
        await interaction.editReply({ content: result.message, embeds: [], components: [] });
        return;
    }

    // Check if combat ended from ability use
    if (result.combatEnd?.ended) {
        return handleCombatEnd(interaction, session, leaderId, guildId, result.combatEnd.victory);
    }

    // Check if player has extra attack (Action Surge, Frenzy) - skip to their bonus action
    const extraAttackPlayer = session.combat?.players.find(p => p.odiscordUserId === odiscordUserId);
    if (extraAttackPlayer?.extraAttack) {
        extraAttackPlayer.extraAttack = false;
        let embed = createCombatEmbed(session);
        embed.setDescription(`**${extraAttackPlayer.name}'s Bonus Action!**`);
        const buttons = createCombatButtons(odiscordUserId, session);
        await updateMainMessage(interaction, session, embed, buttons);
        const { updateSession } = require('../../utils/crawlState');
        updateSession(guildId, session.odiscordUserId, session);
        return;
    }

    // Update main message
    let embed = createCombatEmbed(session);
    embed.setDescription('**Enemies are responding...**');

    const disabledRow = createDisabledButtons(odiscordUserId);
    await updateMainMessage(interaction, session, embed, [disabledRow]);

    // Process monster turns with delays
    await processMonsterTurnsWithDelay(interaction, session, leaderId, guildId, 1500, odiscordUserId);
}

async function handleAbilityTarget(interaction, parts) {
    // Format: crawl_abilitytarget_userId_abilityId
    const odiscordUserId = parts[2];
    const abilityId = parts[3];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const targetId = interaction.values[0];
    const { getSession } = require('../../utils/crawlState');
    const { executeUseAbility } = require('../combat/actions');
    const { createCombatEmbed } = require('../commands/start');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Defer the update on ephemeral
    await interaction.deferUpdate();

    // Execute ability with the selected target
    const result = await executeUseAbility(session, odiscordUserId, abilityId, targetId);

    // Get target name for feedback
    const target = session.combat.players.find(p => p.odiscordUserId === targetId);
    const targetName = target?.name || 'ally';

    // Get ability name
    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const abilities = require('../../data/abilities.json');
    const classAbilities = abilities[player?.class] || {};
    const ability = classAbilities[abilityId];

    if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.message}`, embeds: [], components: [] });
        return;
    }

    // Check if combat ended from ability use
    if (result.combatEnd?.ended) {
        return handleCombatEnd(interaction, session, leaderId, guildId, result.combatEnd.victory);
    }

    // Check if player has extra attack (Action Surge, Frenzy) - skip to their bonus action
    const extraAttackPlayer = session.combat?.players.find(p => p.odiscordUserId === odiscordUserId);
    if (extraAttackPlayer?.extraAttack) {
        extraAttackPlayer.extraAttack = false;
        let embed = createCombatEmbed(session);
        embed.setDescription(`**${extraAttackPlayer.name}'s Bonus Action!**`);
        const buttons = createCombatButtons(odiscordUserId, session);
        await updateMainMessage(interaction, session, embed, buttons);
        const { updateSession } = require('../../utils/crawlState');
        updateSession(guildId, session.odiscordUserId, session);
        return;
    }

    // Update main message
    let embed = createCombatEmbed(session);
    embed.setDescription('**Enemies are responding...**');

    const disabledRow = createDisabledButtons(odiscordUserId);
    await updateMainMessage(interaction, session, embed, [disabledRow]);

    // Process monster turns with delays
    await processMonsterTurnsWithDelay(interaction, session, leaderId, guildId, 1500, odiscordUserId);
}

async function handleCancelAction(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your action to cancel!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { getAvailableActions } = require('../combat/actions');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    // If no active combat, just dismiss
    if (!session || !session.combat) {
        return interaction.update({ content: 'Action cancelled.', embeds: [], components: [] });
    }

    // Go back to the action menu
    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const hasItems = player?.inventory?.some(i => i.type === 'consumable');
    const actions = getAvailableActions(session, odiscordUserId);
    const hasReadyAbilities = actions.abilities.some(a => a.ready);

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`⚔️ ${player?.name || 'Your'}'s Turn`)
        .setDescription('Choose your action:')
        .addFields(
            { name: '⚔️ Attack', value: 'Strike an enemy with your weapon', inline: true },
            { name: '🛡️ Defend', value: '+2 AC, 50% damage reduction', inline: true },
            { name: '🧪 Item', value: hasItems ? 'Use a consumable item' : '*No items*', inline: true },
            { name: '✨ Ability', value: hasReadyAbilities ? 'Use a class ability' : '*On cooldown*', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_attack_${odiscordUserId}`)
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_defend_${odiscordUserId}`)
            .setLabel('Defend')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId(`crawl_item_${odiscordUserId}`)
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧪')
            .setDisabled(!hasItems),
        new ButtonBuilder()
            .setCustomId(`crawl_ability_${odiscordUserId}`)
            .setLabel('Use Ability')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✨')
            .setDisabled(!hasReadyAbilities)
    );

    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleTargetSelect(interaction, parts) {
    // Target selection for abilities that need it
    const odiscordUserId = parts[2];
    // Implementation depends on what triggered target selection
    await interaction.reply({ content: 'Target selection not yet implemented.', flags: MessageFlags.Ephemeral });
}

async function handleProceed(interaction, parts) {
    const odiscordUserId = parts[2];
    const { getSession, updateSession } = require('../../utils/crawlState');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { getCurrentRoom } = require('../dungeon/generator');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session) {
        return interaction.reply({ content: 'No active dungeon session.', flags: MessageFlags.Ephemeral });
    }

    const leaderId = session.isParty ? session.odiscordUserId : odiscordUserId;

    // For party dungeon, show ready check
    if (session.isParty && session.characters.length > 1) {
        // Initialize ready check if not exists
        if (!session.readyCheck) {
            session.readyCheck = {};
        }

        // Mark the clicker as ready
        session.readyCheck[interaction.user.id] = true;
        updateSession(guildId, leaderId, session);

        // Check if all alive party members are ready
        const aliveMembers = session.characters.filter(c => c.currentHp > 0);
        const allReady = aliveMembers.every(c => session.readyCheck[c.odiscordUserId]);

        if (allReady) {
            // Everyone ready - proceed!
            session.readyCheck = null; // Clear for next room
            updateSession(guildId, leaderId, session);
            const { proceedToNextRoom } = require('../commands/start');
            return proceedToNextRoom(interaction, leaderId);
        }

        // Show ready check status
        const readyStatus = aliveMembers.map(c => {
            const isReady = session.readyCheck[c.odiscordUserId];
            return `${isReady ? '✅' : '⏳'} **${c.name}** (${c.currentHp}/${c.maxHp} HP)`;
        }).join('\n');

        const dungeon = session.dungeon;
        const nextRoomNum = dungeon.currentRoom + 2; // +2 because currentRoom is 0-indexed and we're going to next

        const embed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('⚔️ Ready Check - Next Room')
            .setDescription(`Preparing to enter Room ${nextRoomNum}...\n\n${readyStatus}`)
            .addFields(
                { name: 'Progress', value: `Room ${dungeon.currentRoom + 1} of ${dungeon.totalRooms} cleared`, inline: true },
                { name: 'Gold', value: `${dungeon.rewards.totalGold}`, inline: true }
            )
            .setFooter({ text: 'All members must click Ready to proceed' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_ready_${leaderId}_proceed`)
                .setLabel('Ready!')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // Solo dungeon
    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your dungeon!', flags: MessageFlags.Ephemeral });
    }

    const { proceedToNextRoom } = require('../commands/start');
    await proceedToNextRoom(interaction, odiscordUserId);
}

async function handleReady(interaction, parts) {
    // Format: crawl_ready_leaderId_action (enter or proceed)
    const leaderId = parts[2];
    const action = parts[3]; // 'enter' or 'proceed'

    const { getSession, updateSession } = require('../../utils/crawlState');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    const session = getSession(guildId, leaderId);

    if (!session) {
        return interaction.reply({ content: 'No active dungeon session.', flags: MessageFlags.Ephemeral });
    }

    // Verify clicker is a party member
    const isPartyMember = session.characters.some(c => c.odiscordUserId === interaction.user.id);
    if (!isPartyMember) {
        return interaction.reply({ content: 'You\'re not in this party!', flags: MessageFlags.Ephemeral });
    }

    // Initialize ready check if not exists
    if (!session.readyCheck) {
        session.readyCheck = {};
    }

    // Mark this player as ready
    session.readyCheck[interaction.user.id] = true;
    updateSession(guildId, leaderId, session);

    // Check if all alive party members are ready
    const aliveMembers = session.characters.filter(c => c.currentHp > 0);
    const allReady = aliveMembers.every(c => session.readyCheck[c.odiscordUserId]);

    if (allReady) {
        // Everyone ready - execute the action!
        session.readyCheck = null;
        updateSession(guildId, leaderId, session);

        if (action === 'enter') {
            const { enterDungeon } = require('../commands/start');
            return enterDungeon(interaction, leaderId);
        } else if (action === 'proceed') {
            const { proceedToNextRoom } = require('../commands/start');
            return proceedToNextRoom(interaction, leaderId);
        }
    }

    // Not all ready yet - update the status display
    const readyStatus = aliveMembers.map(c => {
        const isReady = session.readyCheck[c.odiscordUserId];
        return `${isReady ? '✅' : '⏳'} **${c.name}** (${c.currentHp}/${c.maxHp} HP)`;
    }).join('\n');

    const title = action === 'enter' ? '⚔️ Ready Check - Enter Dungeon' : '⚔️ Ready Check - Next Room';
    const dungeon = session.dungeon;

    const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle(title)
        .setDescription(`Waiting for all party members...\n\n${readyStatus}`)
        .setFooter({ text: 'All members must click Ready to proceed' });

    if (action === 'proceed') {
        embed.addFields(
            { name: 'Progress', value: `Room ${dungeon.currentRoom + 1} of ${dungeon.totalRooms} cleared`, inline: true },
            { name: 'Gold', value: `${dungeon.rewards.totalGold}`, inline: true }
        );
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_ready_${leaderId}_${action}`)
            .setLabel('Ready!')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
    );

    return interaction.update({ embeds: [embed], components: [row] });
}

async function handleRetreat(interaction, parts) {
    const odiscordUserId = parts[2];
    const { getSession } = require('../../utils/crawlState');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    // Check if it's a party - only leader can retreat
    if (session?.isParty && interaction.user.id !== session.odiscordUserId) {
        return interaction.reply({ content: 'Only the party leader can retreat!', flags: MessageFlags.Ephemeral });
    }

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your dungeon!', flags: MessageFlags.Ephemeral });
    }

    const { retreat } = require('../commands/start');
    await retreat(interaction, odiscordUserId);
}

async function handlePartyInventory(interaction, parts) {
    // Any party member can click this - open THEIR inventory, not the leader's
    const leaderId = parts[2]; // The button has the leader's ID but we ignore it for inventory
    const clickerId = interaction.user.id;

    // Rewrite parts to use the clicker's ID instead
    const newParts = ['crawl', 'inventory', clickerId];
    await handleInventory(interaction, newParts);
}

async function handleInventory(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your inventory!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session) {
        return interaction.reply({ content: 'No active dungeon.', flags: MessageFlags.Ephemeral });
    }

    // Find this specific player's character from the session
    const character = session.characters.find(c => c.odiscordUserId === odiscordUserId) || session.characters[0];
    const inventory = character.inventory || [];

    // Separate items by type
    const weapons = inventory.filter(i => i.type === 'weapon');
    const armor = inventory.filter(i => i.type === 'armor');
    const accessories = inventory.filter(i => i.type === 'accessory');
    const consumables = inventory.filter(i => i.type === 'consumable');

    // Build inventory display
    let inventoryText = '';

    if (character.equipment?.weapon) {
        inventoryText += `**Equipped Weapon:** ⚔️ ${character.equipment.weapon.name}\n`;
    }
    if (character.equipment?.armor) {
        inventoryText += `**Equipped Armor:** 🛡️ ${character.equipment.armor.name}\n`;
    }
    if (character.equipment?.accessory) {
        const acc = character.equipment.accessory;
        let accDesc = acc.name;
        if (acc.acBonus) accDesc += ` (AC +${acc.acBonus})`;
        if (acc.statBonus) accDesc += ` (+${Object.values(acc.statBonus)[0]} ${Object.keys(acc.statBonus)[0]})`;
        if (acc.initiativeBonus) accDesc += ` (+${acc.initiativeBonus} init)`;
        inventoryText += `**Equipped Accessory:** 💍 ${accDesc}\n`;
    }

    inventoryText += `\n**Gold:** ${character.gold || 0}\n`;
    inventoryText += `**HP:** ${character.currentHp}/${character.maxHp}\n\n`;

    if (weapons.length > 0) {
        inventoryText += `**Weapons (${weapons.length}):**\n`;
        inventoryText += weapons.map(w => `⚔️ ${w.name} (${w.damage})`).join('\n') + '\n\n';
    }

    if (armor.length > 0) {
        inventoryText += `**Armor (${armor.length}):**\n`;
        inventoryText += armor.map(a => `🛡️ ${a.name} (AC +${a.acBonus})`).join('\n') + '\n\n';
    }

    if (accessories.length > 0) {
        inventoryText += `**Accessories (${accessories.length}):**\n`;
        inventoryText += accessories.map(a => {
            let desc = `💍 ${a.name}`;
            if (a.acBonus) desc += ` (AC +${a.acBonus})`;
            if (a.statBonus) desc += ` (+${Object.values(a.statBonus)[0]} ${Object.keys(a.statBonus)[0]})`;
            if (a.initiativeBonus) desc += ` (+${a.initiativeBonus} init)`;
            return desc;
        }).join('\n') + '\n\n';
    }

    if (consumables.length > 0) {
        inventoryText += `**Consumables (${consumables.length}):**\n`;
        inventoryText += consumables.map(c => `🧪 ${c.name}${c.quantity > 1 ? ` x${c.quantity}` : ''}`).join('\n');
    }

    if (inventory.length === 0 && !character.equipment?.weapon && !character.equipment?.armor && !character.equipment?.accessory) {
        inventoryText += '*Your inventory is empty.*';
    }

    const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle(`🎒 ${character.name}'s Inventory`)
        .setDescription(inventoryText)
        .setFooter({ text: 'Select an action below' });

    const rows = [];

    // Equip menu if there are equippable items
    const equippable = [...weapons, ...armor, ...accessories];
    if (equippable.length > 0) {
        const equipMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_equip_${odiscordUserId}`)
            .setPlaceholder('Equip an item...')
            .addOptions(equippable.slice(0, 25).map((item, idx) => {
                let description = '';
                let emoji = '⚔️';

                if (item.type === 'weapon') {
                    description = `${item.damage} ${item.damageType || ''}`.trim();
                    emoji = '⚔️';
                } else if (item.type === 'armor') {
                    description = `AC +${item.acBonus}`;
                    emoji = '🛡️';
                } else if (item.type === 'accessory') {
                    if (item.acBonus) description = `AC +${item.acBonus}`;
                    else if (item.statBonus) description = `+${Object.values(item.statBonus)[0]} ${Object.keys(item.statBonus)[0]}`;
                    else if (item.initiativeBonus) description = `+${item.initiativeBonus} initiative`;
                    else if (item.effect?.type === 'regen') description = `Regen ${item.effect.amount}/turn`;
                    else description = 'An accessory';
                    emoji = '💍';
                }

                return {
                    label: item.name,
                    description: description.substring(0, 100),
                    value: `${item.id}_${idx}`,
                    emoji: emoji
                };
            }));
        rows.push(new ActionRowBuilder().addComponents(equipMenu));
    }

    // Use item menu if there are consumables and not at full HP (or any consumable)
    if (consumables.length > 0) {
        const useMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_useoutside_${odiscordUserId}`)
            .setPlaceholder('Use an item...')
            .addOptions(consumables.slice(0, 25).map((item, idx) => ({
                label: `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`,
                description: item.description?.substring(0, 100) || 'A consumable item',
                value: `${item.id}_${idx}`,
                emoji: '🧪'
            })));
        rows.push(new ActionRowBuilder().addComponents(useMenu));
    }

    // Close button (dismisses the ephemeral)
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_closeinv_${odiscordUserId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );
    rows.push(closeRow);

    // Reply with ephemeral inventory
    await interaction.reply({ embeds: [embed], components: rows, flags: MessageFlags.Ephemeral });
}

async function handleEquip(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your inventory!', flags: MessageFlags.Ephemeral });
    }

    const selectedValue = interaction.values[0];
    // Parse the value format: ${item.id}_${idx}
    const selectedIdx = parseInt(selectedValue.split('_').pop());

    const { getSession, updateSession } = require('../../utils/crawlState');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session) {
        return interaction.reply({ content: 'No active dungeon.', flags: MessageFlags.Ephemeral });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Find this specific player's character from the session
    const character = session.characters.find(c => c.odiscordUserId === odiscordUserId) || session.characters[0];
    const inventory = character.inventory || [];

    // Rebuild the same equippable array order to find the item by index
    const invWeapons = inventory.filter(i => i.type === 'weapon');
    const invArmor = inventory.filter(i => i.type === 'armor');
    const invAccessories = inventory.filter(i => i.type === 'accessory');
    const equippableItems = [...invWeapons, ...invArmor, ...invAccessories];
    const item = equippableItems[selectedIdx];

    if (!item) {
        return interaction.reply({ content: 'Item not found in inventory.', flags: MessageFlags.Ephemeral });
    }

    // Initialize equipment if needed
    if (!character.equipment) {
        character.equipment = {};
    }

    let resultMessage = '';
    let oldItemName = null;

    // Unequip current item of same type and put back in inventory
    if (item.type === 'weapon') {
        if (character.equipment.weapon) {
            oldItemName = character.equipment.weapon.name;
            inventory.push(character.equipment.weapon);
        }
        character.equipment.weapon = item;
        resultMessage = oldItemName
            ? `⚔️ Swapped **${oldItemName}** for **${item.name}**!`
            : `⚔️ Equipped **${item.name}**!`;
    } else if (item.type === 'armor') {
        if (character.equipment.armor) {
            oldItemName = character.equipment.armor.name;
            inventory.push(character.equipment.armor);
        }
        character.equipment.armor = item;

        // Recalculate AC (includes accessory bonus if equipped)
        const { getModifier } = require('../../utils/dice');
        const dexMod = getModifier(character.stats.dexterity);
        const accessoryAC = character.equipment.accessory?.acBonus || 0;
        character.ac = 10 + dexMod + (item.acBonus || 0) + accessoryAC;
        resultMessage = oldItemName
            ? `🛡️ Swapped **${oldItemName}** for **${item.name}**! (AC: ${character.ac})`
            : `🛡️ Equipped **${item.name}**! (AC: ${character.ac})`;
    } else if (item.type === 'accessory') {
        const oldAccessory = character.equipment.accessory;
        if (oldAccessory) {
            oldItemName = oldAccessory.name;
            inventory.push(oldAccessory);
            // Remove old accessory stat bonus
            if (oldAccessory.statBonus) {
                for (const [stat, bonus] of Object.entries(oldAccessory.statBonus)) {
                    if (character.stats[stat]) character.stats[stat] -= bonus;
                }
            }
        }
        character.equipment.accessory = item;

        // Apply new accessory stat bonus
        if (item.statBonus) {
            for (const [stat, bonus] of Object.entries(item.statBonus)) {
                if (character.stats[stat] !== undefined) character.stats[stat] += bonus;
            }
        }

        // Recalculate AC if accessory has AC bonus
        const { getModifier } = require('../../utils/dice');
        const dexMod = getModifier(character.stats.dexterity);
        const armorAC = character.equipment.armor?.acBonus || 0;
        const accessoryAC = item.acBonus || 0;
        character.ac = 10 + dexMod + armorAC + accessoryAC;

        // Build result message
        let effectDesc = '';
        if (item.acBonus) effectDesc = `AC +${item.acBonus}`;
        else if (item.statBonus) effectDesc = `+${Object.values(item.statBonus)[0]} ${Object.keys(item.statBonus)[0]}`;
        else if (item.initiativeBonus) effectDesc = `+${item.initiativeBonus} initiative`;
        else if (item.effect?.type === 'regen') effectDesc = `Regen ${item.effect.amount}/turn`;

        resultMessage = oldItemName
            ? `💍 Swapped **${oldItemName}** for **${item.name}**!${effectDesc ? ` (${effectDesc})` : ''}`
            : `💍 Equipped **${item.name}**!${effectDesc ? ` (${effectDesc})` : ''}`;
    }

    // Remove just this specific item from inventory (not all with same ID)
    const itemOriginalIdx = inventory.indexOf(item);
    if (itemOriginalIdx !== -1) {
        inventory.splice(itemOriginalIdx, 1);
        character.inventory = inventory;
    }

    updateSession(guildId, leaderId, session);

    // Rebuild inventory display with result message
    const updatedInventory = character.inventory || [];
    const weapons = updatedInventory.filter(i => i.type === 'weapon');
    const armor = updatedInventory.filter(i => i.type === 'armor');
    const accessories = updatedInventory.filter(i => i.type === 'accessory');
    const consumables = updatedInventory.filter(i => i.type === 'consumable');

    let inventoryText = resultMessage + '\n\n';

    if (character.equipment?.weapon) {
        inventoryText += `**Equipped Weapon:** ⚔️ ${character.equipment.weapon.name}\n`;
    }
    if (character.equipment?.armor) {
        inventoryText += `**Equipped Armor:** 🛡️ ${character.equipment.armor.name}\n`;
    }
    if (character.equipment?.accessory) {
        const acc = character.equipment.accessory;
        let accDesc = acc.name;
        if (acc.acBonus) accDesc += ` (AC +${acc.acBonus})`;
        if (acc.statBonus) accDesc += ` (+${Object.values(acc.statBonus)[0]} ${Object.keys(acc.statBonus)[0]})`;
        if (acc.initiativeBonus) accDesc += ` (+${acc.initiativeBonus} init)`;
        inventoryText += `**Equipped Accessory:** 💍 ${accDesc}\n`;
    }

    inventoryText += `\n**Gold:** ${character.gold || 0}\n`;
    inventoryText += `**HP:** ${character.currentHp}/${character.maxHp}\n\n`;

    if (weapons.length > 0) {
        inventoryText += `**Weapons (${weapons.length}):**\n`;
        inventoryText += weapons.map(w => `⚔️ ${w.name} (${w.damage})`).join('\n') + '\n\n';
    }

    if (armor.length > 0) {
        inventoryText += `**Armor (${armor.length}):**\n`;
        inventoryText += armor.map(a => `🛡️ ${a.name} (AC +${a.acBonus})`).join('\n') + '\n\n';
    }

    if (accessories.length > 0) {
        inventoryText += `**Accessories (${accessories.length}):**\n`;
        inventoryText += accessories.map(a => {
            let desc = `💍 ${a.name}`;
            if (a.acBonus) desc += ` (AC +${a.acBonus})`;
            if (a.statBonus) desc += ` (+${Object.values(a.statBonus)[0]} ${Object.keys(a.statBonus)[0]})`;
            if (a.initiativeBonus) desc += ` (+${a.initiativeBonus} init)`;
            return desc;
        }).join('\n') + '\n\n';
    }

    if (consumables.length > 0) {
        inventoryText += `**Consumables (${consumables.length}):**\n`;
        inventoryText += consumables.map(c => `🧪 ${c.name}${c.quantity > 1 ? ` x${c.quantity}` : ''}`).join('\n');
    }

    if (updatedInventory.length === 0 && !character.equipment?.weapon && !character.equipment?.armor && !character.equipment?.accessory) {
        inventoryText += '*Your inventory is empty.*';
    }

    const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle(`🎒 ${character.name}'s Inventory`)
        .setDescription(inventoryText)
        .setFooter({ text: 'Select an action below' });

    const rows = [];

    // Equip menu if there are equippable items (weapons, armor, accessories)
    const equippable = [...weapons, ...armor, ...accessories];
    if (equippable.length > 0) {
        const equipMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_equip_${odiscordUserId}`)
            .setPlaceholder('Equip an item...')
            .addOptions(equippable.slice(0, 25).map((itm, idx) => {
                let description = '';
                let emoji = '⚔️';

                if (itm.type === 'weapon') {
                    description = `${itm.damage} ${itm.damageType || ''}`.trim();
                    emoji = '⚔️';
                } else if (itm.type === 'armor') {
                    description = `AC +${itm.acBonus}`;
                    emoji = '🛡️';
                } else if (itm.type === 'accessory') {
                    if (itm.acBonus) description = `AC +${itm.acBonus}`;
                    else if (itm.statBonus) description = `+${Object.values(itm.statBonus)[0]} ${Object.keys(itm.statBonus)[0]}`;
                    else if (itm.initiativeBonus) description = `+${itm.initiativeBonus} initiative`;
                    else if (itm.effect?.type === 'regen') description = `Regen ${itm.effect.amount}/turn`;
                    else description = 'An accessory';
                    emoji = '💍';
                }

                return {
                    label: itm.name,
                    description: description.substring(0, 100),
                    value: `${itm.id}_${idx}`,
                    emoji: emoji
                };
            }));
        rows.push(new ActionRowBuilder().addComponents(equipMenu));
    }

    // Use item menu if there are consumables
    if (consumables.length > 0) {
        const useMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_useoutside_${odiscordUserId}`)
            .setPlaceholder('Use an item...')
            .addOptions(consumables.slice(0, 25).map((itm, idx) => ({
                label: `${itm.name}${itm.quantity > 1 ? ` (x${itm.quantity})` : ''}`,
                description: itm.description?.substring(0, 100) || 'A consumable item',
                value: `${itm.id}_${idx}`,
                emoji: '🧪'
            })));
        rows.push(new ActionRowBuilder().addComponents(useMenu));
    }

    // Close button (dismisses the ephemeral)
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_closeinv_${odiscordUserId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );
    rows.push(closeRow);

    await interaction.update({ embeds: [embed], components: rows });
}

async function handleUseOutsideCombat(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your inventory!', flags: MessageFlags.Ephemeral });
    }

    const selectedValue = interaction.values[0];
    // Parse the value format: ${item.id}_${idx}
    const selectedIdx = parseInt(selectedValue.split('_').pop());

    const { getSession, updateSession } = require('../../utils/crawlState');
    const { rollDiceTotal } = require('../../utils/dice');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session) {
        return interaction.reply({ content: 'No active dungeon.', flags: MessageFlags.Ephemeral });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    // Find this specific player's character from the session
    const character = session.characters.find(c => c.odiscordUserId === odiscordUserId) || session.characters[0];
    const inventory = character.inventory || [];

    // Find item by index in consumables array (to handle duplicates)
    const invConsumables = inventory.filter(i => i.type === 'consumable');
    const item = invConsumables[selectedIdx];

    if (!item) {
        return interaction.reply({ content: 'Item not found in inventory.', flags: MessageFlags.Ephemeral });
    }

    let resultMessage = '';

    // Process item effect
    if (item.effect) {
        switch (item.effect.type) {
            case 'heal': {
                const healAmount = rollDiceTotal(item.effect.amount);
                const oldHp = character.currentHp;
                character.currentHp = Math.min(character.maxHp, character.currentHp + healAmount);
                const actualHeal = character.currentHp - oldHp;
                resultMessage = `✨ Used **${item.name}** and restored **${actualHeal}** HP!`;
                break;
            }
            default:
                resultMessage = `✨ Used **${item.name}**.`;
        }
    } else {
        resultMessage = `✨ Used **${item.name}**.`;
    }

    // Remove or reduce quantity of the specific item
    if (item.quantity > 1) {
        item.quantity--;
    } else {
        // Remove just this specific item from inventory
        const itemOriginalIdx = inventory.indexOf(item);
        if (itemOriginalIdx !== -1) {
            inventory.splice(itemOriginalIdx, 1);
            character.inventory = inventory;
        }
    }

    updateSession(guildId, leaderId, session);

    // Rebuild inventory display with result message
    const updatedInventory = character.inventory || [];
    const weapons = updatedInventory.filter(i => i.type === 'weapon');
    const armor = updatedInventory.filter(i => i.type === 'armor');
    const accessories = updatedInventory.filter(i => i.type === 'accessory');
    const consumables = updatedInventory.filter(i => i.type === 'consumable');

    let inventoryText = resultMessage + '\n\n';

    if (character.equipment?.weapon) {
        inventoryText += `**Equipped Weapon:** ⚔️ ${character.equipment.weapon.name}\n`;
    }
    if (character.equipment?.armor) {
        inventoryText += `**Equipped Armor:** 🛡️ ${character.equipment.armor.name}\n`;
    }
    if (character.equipment?.accessory) {
        const acc = character.equipment.accessory;
        let accDesc = acc.name;
        if (acc.acBonus) accDesc += ` (AC +${acc.acBonus})`;
        if (acc.statBonus) accDesc += ` (+${Object.values(acc.statBonus)[0]} ${Object.keys(acc.statBonus)[0]})`;
        if (acc.initiativeBonus) accDesc += ` (+${acc.initiativeBonus} init)`;
        inventoryText += `**Equipped Accessory:** 💍 ${accDesc}\n`;
    }

    inventoryText += `\n**Gold:** ${character.gold || 0}\n`;
    inventoryText += `**HP:** ${character.currentHp}/${character.maxHp}\n\n`;

    if (weapons.length > 0) {
        inventoryText += `**Weapons (${weapons.length}):**\n`;
        inventoryText += weapons.map(w => `⚔️ ${w.name} (${w.damage})`).join('\n') + '\n\n';
    }

    if (armor.length > 0) {
        inventoryText += `**Armor (${armor.length}):**\n`;
        inventoryText += armor.map(a => `🛡️ ${a.name} (AC +${a.acBonus})`).join('\n') + '\n\n';
    }

    if (accessories.length > 0) {
        inventoryText += `**Accessories (${accessories.length}):**\n`;
        inventoryText += accessories.map(a => {
            let desc = `💍 ${a.name}`;
            if (a.acBonus) desc += ` (AC +${a.acBonus})`;
            if (a.statBonus) desc += ` (+${Object.values(a.statBonus)[0]} ${Object.keys(a.statBonus)[0]})`;
            if (a.initiativeBonus) desc += ` (+${a.initiativeBonus} init)`;
            return desc;
        }).join('\n') + '\n\n';
    }

    if (consumables.length > 0) {
        inventoryText += `**Consumables (${consumables.length}):**\n`;
        inventoryText += consumables.map(c => `🧪 ${c.name}${c.quantity > 1 ? ` x${c.quantity}` : ''}`).join('\n');
    }

    if (updatedInventory.length === 0 && !character.equipment?.weapon && !character.equipment?.armor && !character.equipment?.accessory) {
        inventoryText += '*Your inventory is empty.*';
    }

    const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle(`🎒 ${character.name}'s Inventory`)
        .setDescription(inventoryText)
        .setFooter({ text: 'Select an action below' });

    const rows = [];

    // Equip menu if there are equippable items (weapons, armor, accessories)
    const equippable = [...weapons, ...armor, ...accessories];
    if (equippable.length > 0) {
        const equipMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_equip_${odiscordUserId}`)
            .setPlaceholder('Equip an item...')
            .addOptions(equippable.slice(0, 25).map((itm, idx) => {
                let description = '';
                let emoji = '⚔️';

                if (itm.type === 'weapon') {
                    description = `${itm.damage} ${itm.damageType || ''}`.trim();
                    emoji = '⚔️';
                } else if (itm.type === 'armor') {
                    description = `AC +${itm.acBonus}`;
                    emoji = '🛡️';
                } else if (itm.type === 'accessory') {
                    if (itm.acBonus) description = `AC +${itm.acBonus}`;
                    else if (itm.statBonus) description = `+${Object.values(itm.statBonus)[0]} ${Object.keys(itm.statBonus)[0]}`;
                    else if (itm.initiativeBonus) description = `+${itm.initiativeBonus} initiative`;
                    else if (itm.effect?.type === 'regen') description = `Regen ${itm.effect.amount}/turn`;
                    else description = 'An accessory';
                    emoji = '💍';
                }

                return {
                    label: itm.name,
                    description: description.substring(0, 100),
                    value: `${itm.id}_${idx}`,
                    emoji: emoji
                };
            }));
        rows.push(new ActionRowBuilder().addComponents(equipMenu));
    }

    // Use item menu if there are consumables
    if (consumables.length > 0) {
        const useMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_useoutside_${odiscordUserId}`)
            .setPlaceholder('Use an item...')
            .addOptions(consumables.slice(0, 25).map((itm, idx) => ({
                label: `${itm.name}${itm.quantity > 1 ? ` (x${itm.quantity})` : ''}`,
                description: itm.description?.substring(0, 100) || 'A consumable item',
                value: `${itm.id}_${idx}`,
                emoji: '🧪'
            })));
        rows.push(new ActionRowBuilder().addComponents(useMenu));
    }

    // Close button (dismisses the ephemeral)
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_closeinv_${odiscordUserId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✖️')
    );
    rows.push(closeRow);

    await interaction.update({ embeds: [embed], components: rows });
}

async function handleBackToDungeon(interaction, parts) {
    const odiscordUserId = parts[2];

    const { getSession } = require('../../utils/crawlState');
    const { createProceedButtons } = require('../commands/start');
    const { getCurrentRoom } = require('../dungeon/generator');
    const { EmbedBuilder } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session) {
        return interaction.reply({ content: 'No active dungeon.', flags: MessageFlags.Ephemeral });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    const dungeon = session.dungeon;
    const room = getCurrentRoom(dungeon);

    // Build party HP status for parties
    let hpField;
    if (session.isParty) {
        hpField = {
            name: 'Party HP',
            value: session.characters.map(c => `**${c.name}**: ${c.currentHp}/${c.maxHp}`).join('\n'),
            inline: false
        };
    } else {
        const character = session.characters[0];
        hpField = { name: 'HP', value: `${character.currentHp}/${character.maxHp}`, inline: true };
    }

    // Show current room status
    const embed = new EmbedBuilder()
        .setColor(room.cleared ? 0x00FF00 : 0x7B2D26)
        .setTitle(`Room ${dungeon.currentRoom + 1}: ${room.name}`)
        .setDescription(room.cleared ? '*Room cleared!*\n\nChoose your next action.' : room.description)
        .addFields(
            hpField,
            { name: 'Progress', value: `Room ${dungeon.currentRoom + 1} of ${dungeon.totalRooms}`, inline: true }
        )
        .setFooter({ text: `Gold: ${dungeon.rewards.totalGold} | XP: ${dungeon.rewards.totalXp}` });

    const buttons = createProceedButtons(leaderId, session);

    await interaction.update({ embeds: [embed], components: buttons });
}

// Store pending stat selections temporarily
const pendingStatSelections = new Map();

async function handleStatPointSelect(interaction, parts) {
    const statType = parts[1]; // 'statpoint1' or 'statpoint2'
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'These are not your stat points!', flags: MessageFlags.Ephemeral });
    }

    const selectedStat = interaction.values[0];
    const key = `${interaction.guild.id}-${odiscordUserId}`;

    // Get or create pending selection
    if (!pendingStatSelections.has(key)) {
        pendingStatSelections.set(key, { stat1: null, stat2: null });
    }
    const pending = pendingStatSelections.get(key);

    // Store selection
    if (statType === 'statpoint1') {
        pending.stat1 = selectedStat;
    } else {
        pending.stat2 = selectedStat;
    }

    // If both selections made, apply them
    if (pending.stat1 && pending.stat2) {
        const { getCharacter, saveCharacter } = require('../../utils/persistence');
        const { applyStatPoints } = require('../character/leveling');
        const { getModifier } = require('../../utils/dice');
        const { EmbedBuilder } = require('discord.js');

        const guildId = interaction.guild.id;
        const character = await getCharacter(guildId, odiscordUserId);

        if (!character) {
            pendingStatSelections.delete(key);
            return interaction.reply({ content: 'Character not found!', flags: MessageFlags.Ephemeral });
        }

        const result = applyStatPoints(character, pending.stat1, pending.stat2);
        pendingStatSelections.delete(key);

        if (!result.success) {
            return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        }

        await saveCharacter(guildId, odiscordUserId, character);

        const formatMod = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

        let description = `Successfully increased **${pending.stat1}** and **${pending.stat2}**!\n\n`;
        description += '**Updated Stats:**\n';
        description += `STR: ${character.stats.strength} (${formatMod(getModifier(character.stats.strength))})\n`;
        description += `DEX: ${character.stats.dexterity} (${formatMod(getModifier(character.stats.dexterity))})\n`;
        description += `CON: ${character.stats.constitution} (${formatMod(getModifier(character.stats.constitution))})\n`;
        description += `INT: ${character.stats.intelligence} (${formatMod(getModifier(character.stats.intelligence))})\n`;
        description += `WIS: ${character.stats.wisdom} (${formatMod(getModifier(character.stats.wisdom))})\n`;
        description += `CHA: ${character.stats.charisma} (${formatMod(getModifier(character.stats.charisma))})\n`;

        if (character.pendingStatPoints >= 2) {
            description += `\n*You still have ${character.pendingStatPoints} stat points remaining!*`;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Stats Increased!')
            .setDescription(description);

        await interaction.update({ embeds: [embed], components: [] });
    } else {
        // One selection made, waiting for the other
        const waitingFor = statType === 'statpoint1' ? 'second' : 'first';
        await interaction.reply({
            content: `Selected **${selectedStat}** for ${statType === 'statpoint1' ? 'first' : 'second'} point. Now select your ${waitingFor} stat.`,
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleInvEquip(interaction, parts) {
    const itemType = parts[2]; // 'weapon', 'armor', or 'accessory'
    const odiscordUserId = parts[3];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your inventory!', flags: MessageFlags.Ephemeral });
    }

    const selectedValue = interaction.values[0];
    // Parse the value format: ${item.id}_${idx}
    const selectedIdx = parseInt(selectedValue.split('_').pop());

    const { getCharacter, saveCharacter } = require('../../utils/persistence');
    const { getModifier } = require('../../utils/dice');
    const { createInventoryEmbed, createInventoryComponents } = require('../commands/inventory');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, odiscordUserId);

    if (!character) {
        return interaction.reply({ content: 'Character not found!', flags: MessageFlags.Ephemeral });
    }

    const inventory = character.inventory || [];

    // Find item by index in the type-specific array
    let typeItems;
    if (itemType === 'weapon') {
        typeItems = inventory.filter(i => i.type === 'weapon');
    } else if (itemType === 'armor') {
        typeItems = inventory.filter(i => i.type === 'armor');
    } else if (itemType === 'accessory') {
        typeItems = inventory.filter(i => i.type === 'accessory');
    } else {
        return interaction.reply({ content: 'Invalid item type.', flags: MessageFlags.Ephemeral });
    }
    const item = typeItems[selectedIdx];

    if (!item) {
        return interaction.reply({ content: 'Item not found in inventory.', flags: MessageFlags.Ephemeral });
    }

    if (!character.equipment) {
        character.equipment = {};
    }

    let resultMessage = '';
    let oldItemName = null;

    if (item.type === 'weapon') {
        if (character.equipment.weapon) {
            oldItemName = character.equipment.weapon.name;
            inventory.push(character.equipment.weapon);
        }
        character.equipment.weapon = item;
        resultMessage = oldItemName
            ? `⚔️ Swapped **${oldItemName}** for **${item.name}**!`
            : `⚔️ Equipped **${item.name}**!`;
    } else if (item.type === 'armor') {
        if (character.equipment.armor) {
            oldItemName = character.equipment.armor.name;
            inventory.push(character.equipment.armor);
        }
        character.equipment.armor = item;

        // Recalculate AC with armor and accessory
        const dexMod = getModifier(character.stats.dexterity);
        const armorAc = item.acBonus || 0;
        const accessoryAc = character.equipment.accessory?.acBonus || 0;
        character.ac = 10 + dexMod + armorAc + accessoryAc;
        character.armorClass = character.ac;
        resultMessage = oldItemName
            ? `🛡️ Swapped **${oldItemName}** for **${item.name}**! (AC: ${character.ac})`
            : `🛡️ Equipped **${item.name}**! (AC: ${character.ac})`;
    } else if (item.type === 'accessory') {
        const oldAccessory = character.equipment.accessory;
        if (oldAccessory) {
            oldItemName = oldAccessory.name;
            inventory.push(oldAccessory);
            // Remove old accessory stat bonus
            if (oldAccessory.statBonus) {
                for (const [stat, bonus] of Object.entries(oldAccessory.statBonus)) {
                    if (character.stats[stat]) character.stats[stat] -= bonus;
                }
            }
        }
        character.equipment.accessory = item;

        // Apply new accessory stat bonus
        if (item.statBonus) {
            for (const [stat, bonus] of Object.entries(item.statBonus)) {
                if (character.stats[stat] !== undefined) character.stats[stat] += bonus;
            }
        }

        // Recalculate AC with accessory bonus
        const dexMod = getModifier(character.stats.dexterity);
        const armorAc = character.equipment.armor?.acBonus || 0;
        const accessoryAc = item.acBonus || 0;
        character.ac = 10 + dexMod + armorAc + accessoryAc;
        character.armorClass = character.ac;

        // Build description for the result message
        let effectDesc = '';
        if (item.acBonus) effectDesc += ` AC +${item.acBonus}`;
        if (item.statBonus) effectDesc += ` +${Object.values(item.statBonus)[0]} ${Object.keys(item.statBonus)[0]}`;
        if (item.initiativeBonus) effectDesc += ` +${item.initiativeBonus} initiative`;
        if (item.effect?.type === 'regen') effectDesc += ` regenerate ${item.effect.amount} HP/turn`;

        resultMessage = oldItemName
            ? `💍 Swapped **${oldItemName}** for **${item.name}**!${effectDesc}`
            : `💍 Equipped **${item.name}**!${effectDesc}`;
    }

    // Remove just this specific item from inventory
    const itemOriginalIdx = inventory.indexOf(item);
    if (itemOriginalIdx !== -1) {
        inventory.splice(itemOriginalIdx, 1);
        character.inventory = inventory;
    }
    await saveCharacter(guildId, odiscordUserId, character);

    const embed = createInventoryEmbed(character, resultMessage);
    const components = createInventoryComponents(character, odiscordUserId);

    await interaction.update({ embeds: [embed], components });
}

async function handlePartyJoin(interaction, parts) {
    const odiscordUserId = parts[2];
    const leaderId = parts[3];

    const { handlePartyJoinButton } = require('../commands/party');
    await handlePartyJoinButton(interaction, odiscordUserId, leaderId);
}

async function handlePartyDecline(interaction, parts) {
    const odiscordUserId = parts[2];

    const { handlePartyDeclineButton } = require('../commands/party');
    await handlePartyDeclineButton(interaction, odiscordUserId);
}

async function handleInvUse(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'This is not your inventory!', flags: MessageFlags.Ephemeral });
    }

    const selectedValue = interaction.values[0];
    // Parse the value format: ${item.id}_${idx}
    const selectedIdx = parseInt(selectedValue.split('_').pop());

    const { getCharacter, saveCharacter } = require('../../utils/persistence');
    const { rollDiceTotal } = require('../../utils/dice');
    const { createInventoryEmbed, createInventoryComponents } = require('../commands/inventory');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, odiscordUserId);

    if (!character) {
        return interaction.reply({ content: 'Character not found!', flags: MessageFlags.Ephemeral });
    }

    const inventory = character.inventory || [];

    // Find item by index in consumables array
    const consumables = inventory.filter(i => i.type === 'consumable');
    const item = consumables[selectedIdx];

    if (!item) {
        return interaction.reply({ content: 'Item not found in inventory.', flags: MessageFlags.Ephemeral });
    }

    let resultMessage = '';

    if (item.effect) {
        switch (item.effect.type) {
            case 'heal': {
                const healAmount = rollDiceTotal(item.effect.amount);
                const oldHp = character.currentHp;
                character.currentHp = Math.min(character.maxHp, character.currentHp + healAmount);
                const actualHeal = character.currentHp - oldHp;
                resultMessage = `✨ Used **${item.name}** and restored **${actualHeal}** HP! (${character.currentHp}/${character.maxHp})`;
                break;
            }
            default:
                resultMessage = `✨ Used **${item.name}**.`;
        }
    } else {
        resultMessage = `✨ Used **${item.name}**.`;
    }

    // Remove or reduce quantity of the specific item
    if (item.quantity > 1) {
        item.quantity--;
    } else {
        // Remove just this specific item from inventory
        const itemOriginalIdx = inventory.indexOf(item);
        if (itemOriginalIdx !== -1) {
            inventory.splice(itemOriginalIdx, 1);
            character.inventory = inventory;
        }
    }

    await saveCharacter(guildId, odiscordUserId, character);

    const embed = createInventoryEmbed(character, resultMessage);
    const components = createInventoryComponents(character, odiscordUserId);

    await interaction.update({ embeds: [embed], components });
}

// ============================================
// SHOP INTERACTION HANDLERS
// ============================================

/**
 * Handle shop category button click
 */
async function handleShopCategory(interaction, parts) {
    const userId = parts[2];
    const category = parts[3]; // weapons, armor, accessories, consumables

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter } = require('../../utils/persistence');
    const { createCategoryEmbed } = require('../commands/shop');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const { embed, components } = createCategoryEmbed(character, guildId, userId, category);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle shop buy select menu
 */
async function handleShopBuy(interaction, parts) {
    const userId = parts[2];
    const category = parts[3];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const selectedValue = interaction.values[0];
    const selectedIdx = parseInt(selectedValue.split('_').pop());

    const { getCharacter } = require('../../utils/persistence');
    const { getShopRotation } = require('../shop/shopState');
    const { createItemDetailEmbed } = require('../commands/shop');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const rotation = getShopRotation(guildId);
    const categoryItems = rotation.items[category] || [];
    const item = categoryItems[selectedIdx];

    if (!item) {
        return interaction.update({ content: 'Item not found in shop!', embeds: [], components: [] });
    }

    const { embed, components } = createItemDetailEmbed(character, item, userId, category, selectedIdx);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle shop purchase confirmation
 */
async function handleShopConfirm(interaction, parts) {
    const userId = parts[2];
    const category = parts[3];
    const itemIndex = parseInt(parts[4]);

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter, saveCharacter } = require('../../utils/persistence');
    const { getShopRotation } = require('../shop/shopState');
    const { buyItem } = require('../shop/shopManager');
    const { createCategoryEmbed } = require('../commands/shop');
    const { EmbedBuilder } = require('discord.js');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const rotation = getShopRotation(guildId);
    const categoryItems = rotation.items[category] || [];
    const item = categoryItems[itemIndex];

    if (!item) {
        return interaction.update({ content: 'Item no longer available!', embeds: [], components: [] });
    }

    const result = buyItem(character, item);

    if (!result.success) {
        // Show error and return to category
        const { embed, components } = createCategoryEmbed(character, guildId, userId, category);
        embed.setDescription(`❌ ${result.message}\n\n` + embed.data.description);
        return interaction.update({ embeds: [embed], components });
    }

    // Save character and show success
    await saveCharacter(guildId, userId, character);

    const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Purchase Complete!')
        .setDescription(result.message)
        .addFields(
            { name: 'Remaining Gold', value: `💰 ${character.gold}`, inline: true }
        );

    // Return to category after short delay (show success first)
    const { createCategoryEmbed: createCat } = require('../commands/shop');
    const { embed: catEmbed, components: catComponents } = createCat(character, guildId, userId, category);

    await interaction.update({ embeds: [successEmbed], components: catComponents });
}

/**
 * Handle back to category from item detail
 */
async function handleShopCategoryBack(interaction, parts) {
    const userId = parts[2];
    const category = parts[3];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter } = require('../../utils/persistence');
    const { createCategoryEmbed } = require('../commands/shop');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const { embed, components } = createCategoryEmbed(character, guildId, userId, category);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle back to shop overview
 */
async function handleShopBack(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter } = require('../../utils/persistence');
    const { getShopRotation, formatTimeUntilRotation } = require('../shop/shopState');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const rotation = getShopRotation(guildId);
    const timeLeft = formatTimeUntilRotation(rotation.timeUntilRotation);

    const embed = new EmbedBuilder()
        .setColor(0xDAA520)
        .setTitle('🏪 The Wandering Merchant')
        .setDescription(
            `*"Welcome, adventurer! Take a look at my wares..."*\n\n` +
            `The merchant's stock rotates hourly. Browse while you can!\n\n` +
            `**Your Gold:** 💰 ${character.gold || 0}`
        )
        .addFields(
            { name: '⚔️ Weapons', value: `${rotation.items.weapons.length} available`, inline: true },
            { name: '🛡️ Armor', value: `${rotation.items.armor.length} available`, inline: true },
            { name: '💍 Accessories', value: `${rotation.items.accessories.length} available`, inline: true },
            { name: '🧪 Consumables', value: `${rotation.items.consumables.length} available`, inline: true },
            { name: '💰 Sell Items', value: 'Sell for 50% value', inline: true },
            { name: '⏱️ Next Rotation', value: timeLeft, inline: true }
        )
        .setFooter({ text: 'Select a category to browse items' });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_shopcategory_${userId}_weapons`)
            .setLabel('Weapons')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_shopcategory_${userId}_armor`)
            .setLabel('Armor')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId(`crawl_shopcategory_${userId}_accessories`)
            .setLabel('Accessories')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💍'),
        new ButtonBuilder()
            .setCustomId(`crawl_shopcategory_${userId}_consumables`)
            .setLabel('Consumables')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🧪')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_shopsell_${userId}`)
            .setLabel('Sell Items')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💰'),
        new ButtonBuilder()
            .setCustomId(`crawl_shopclose_${userId}`)
            .setLabel('Close Shop')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️')
    );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
}

/**
 * Handle sell menu button
 */
async function handleShopSellMenu(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter } = require('../../utils/persistence');
    const { createSellEmbed } = require('../commands/shop');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const { embed, components } = createSellEmbed(character, userId);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle sell item selection
 */
async function handleShopSellSelect(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const inventoryIndex = parseInt(interaction.values[0]);

    const { getCharacter } = require('../../utils/persistence');
    const { createSellConfirmEmbed } = require('../commands/shop');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const inventory = character.inventory || [];
    const item = inventory[inventoryIndex];

    if (!item) {
        return interaction.update({ content: 'Item not found in inventory!', embeds: [], components: [] });
    }

    const { embed, components } = createSellConfirmEmbed(character, item, inventoryIndex, userId);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle sell confirmation
 */
async function handleShopSellConfirm(interaction, parts) {
    const userId = parts[2];
    const inventoryIndex = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter, saveCharacter } = require('../../utils/persistence');
    const { sellItem } = require('../shop/shopManager');
    const { createSellEmbed } = require('../commands/shop');
    const { EmbedBuilder } = require('discord.js');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const result = sellItem(character, inventoryIndex);

    if (!result.success) {
        const { embed, components } = createSellEmbed(character, userId);
        embed.setDescription(`❌ ${result.message}\n\n` + embed.data.description);
        return interaction.update({ embeds: [embed], components });
    }

    // Save character
    await saveCharacter(guildId, userId, character);

    // Show success and return to sell menu
    const { embed: sellEmbed, components: sellComponents } = createSellEmbed(character, userId);
    const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Item Sold!')
        .setDescription(result.message)
        .addFields(
            { name: 'New Gold Total', value: `💰 ${character.gold}`, inline: true }
        );

    await interaction.update({ embeds: [successEmbed], components: sellComponents });
}

/**
 * Handle back from sell confirm to sell menu
 */
async function handleShopSellBack(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter } = require('../../utils/persistence');
    const { createSellEmbed } = require('../commands/shop');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const { embed, components } = createSellEmbed(character, userId);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle shop close
 */
async function handleShopClose(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'This is not your shop!', flags: MessageFlags.Ephemeral });
    }

    await interaction.update({
        content: '*The merchant waves goodbye as you leave the shop.*',
        embeds: [],
        components: []
    });
}

// ============================================
// ABILITY INTERACTION HANDLERS
// ============================================

/**
 * Handle ability view selection
 */
async function handleAbilityView(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'These are not your abilities!', flags: MessageFlags.Ephemeral });
    }

    const abilityId = interaction.values[0];
    const { getCharacter } = require('../../utils/persistence');
    const { createAbilityDetailEmbed } = require('../commands/abilities');
    const abilities = require('../../data/abilities.json');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const classAbilities = abilities[character.class] || {};
    const ability = classAbilities[abilityId];

    if (!ability) {
        return interaction.update({ content: 'Ability not found!', embeds: [], components: [] });
    }

    const isKnown = (character.abilities || []).includes(abilityId);
    const { embed } = createAbilityDetailEmbed(ability, character, isKnown, userId);

    const row = new ActionRowBuilder().addComponents(
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

    await interaction.update({ embeds: [embed], components: [row] });
}

/**
 * Handle back to ability list
 */
async function handleAbilityList(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'These are not your abilities!', flags: MessageFlags.Ephemeral });
    }

    const { getCharacter } = require('../../utils/persistence');
    const { createAbilityListEmbed } = require('../commands/abilities');

    const guildId = interaction.guild.id;
    const character = await getCharacter(guildId, userId);

    if (!character) {
        return interaction.update({ content: 'Character not found!', embeds: [], components: [] });
    }

    const { embed, components } = createAbilityListEmbed(character, userId);
    await interaction.update({ embeds: [embed], components });
}

/**
 * Handle ability close
 */
async function handleAbilityClose(interaction, parts) {
    const userId = parts[2];

    if (interaction.user.id !== userId) {
        return interaction.reply({ content: 'These are not your abilities!', flags: MessageFlags.Ephemeral });
    }

    await interaction.update({
        content: '*Closed ability viewer.*',
        embeds: [],
        components: []
    });
}

// ============================================
// Movement Handlers
// ============================================

async function handleMoveAction(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession } = require('../../utils/crawlState');
    const { getValidMovePositions } = require('../combat/grid');
    const { renderMovementGrid } = require('../combat/grid');
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    if (!player || !player.position) {
        return interaction.update({ content: 'Cannot move - no position assigned.', embeds: [], components: [] });
    }

    const movementLeft = player.movementRemaining ?? 6;
    if (movementLeft <= 0) {
        return interaction.update({ content: 'No movement remaining this turn!', embeds: [], components: [] });
    }

    // Get valid move positions
    const validMoves = getValidMovePositions(
        session.combat.grid, player.position, movementLeft, player.odiscordUserId
    );

    if (validMoves.length === 0) {
        return interaction.update({ content: 'No valid movement positions available!', embeds: [], components: [] });
    }

    // Render movement grid
    const gridStr = renderMovementGrid(session.combat, validMoves, player.position);

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🏃 Move')
        .setDescription(`Movement remaining: **${movementLeft}** squares\nCurrent position: (${player.position.x}, ${player.position.y})`)
        .addFields({
            name: 'Battlefield',
            value: '```\n' + gridStr + '```',
            inline: false
        });

    // Create select menu with valid positions (limit to 25)
    const options = validMoves.slice(0, 25).map(pos => ({
        label: `(${pos.x}, ${pos.y})`,
        description: `${pos.distance} square${pos.distance !== 1 ? 's' : ''} away`,
        value: `${pos.x},${pos.y}`
    }));

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_moveselect_${odiscordUserId}`)
        .setPlaceholder('Select destination')
        .addOptions(options);

    const menuRow = new ActionRowBuilder().addComponents(menu);
    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_cancelaction_${odiscordUserId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [menuRow, cancelRow] });
}

async function handleMoveSelect(interaction, parts) {
    const odiscordUserId = parts[2];

    if (interaction.user.id !== odiscordUserId) {
        return interaction.reply({ content: 'It\'s not your turn!', flags: MessageFlags.Ephemeral });
    }

    const { getSession, updateSession } = require('../../utils/crawlState');
    const { executeMovement, getAvailableActions } = require('../combat/actions');
    const { createCombatEmbed } = require('../commands/start');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const guildId = interaction.guild.id;
    let session = getSession(guildId, odiscordUserId);

    // For party members, get the leader's session
    if (session?.linkedTo) {
        session = getSession(guildId, session.linkedTo);
    }

    if (!session || !session.combat) {
        return interaction.update({ content: 'No active combat.', embeds: [], components: [] });
    }

    const [x, y] = interaction.values[0].split(',').map(Number);
    const result = await executeMovement(session, odiscordUserId, { x, y });

    if (!result.success) {
        return interaction.update({ content: `Failed to move: ${result.message}`, embeds: [], components: [] });
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    updateSession(guildId, leaderId, session);

    // Update the main message with new grid
    const mainEmbed = createCombatEmbed(session);
    await updateMainMessage(interaction, session, mainEmbed, []);

    // Show updated action menu (movement doesn't end turn)
    const player = session.combat.players.find(p => p.odiscordUserId === odiscordUserId);
    const hasItems = player?.inventory?.some(i => i.type === 'consumable');
    const actions = getAvailableActions(session, odiscordUserId);
    const hasReadyAbilities = actions.abilities.some(a => a.ready);
    const movementLeft = player?.movementRemaining ?? 0;
    const canMove = movementLeft > 0;

    const actionEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`⚔️ ${player?.name || 'Your'}'s Turn`)
        .setDescription(`Moved to (${x}, ${y})! ${movementLeft} movement remaining.\nChoose your next action:`)
        .addFields(
            { name: '⚔️ Attack', value: 'Strike an enemy', inline: true },
            { name: '🛡️ Defend', value: '+2 AC, 50% dmg reduction', inline: true },
            { name: '🧪 Item', value: hasItems ? 'Use item' : '*No items*', inline: true },
            { name: '✨ Ability', value: hasReadyAbilities ? 'Use ability' : '*On cooldown*', inline: true },
            { name: '🏃 Move', value: canMove ? `${movementLeft} sq left` : '*No movement*', inline: true }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_attack_${odiscordUserId}`)
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_defend_${odiscordUserId}`)
            .setLabel('Defend')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId(`crawl_move_${odiscordUserId}`)
            .setLabel('Move')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏃')
            .setDisabled(!canMove),
        new ButtonBuilder()
            .setCustomId(`crawl_item_${odiscordUserId}`)
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧪')
            .setDisabled(!hasItems),
        new ButtonBuilder()
            .setCustomId(`crawl_ability_${odiscordUserId}`)
            .setLabel('Use Ability')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✨')
            .setDisabled(!hasReadyAbilities)
    );

    await interaction.update({ embeds: [actionEmbed], components: [row] });
}

module.exports = { handleCrawlInteraction };
