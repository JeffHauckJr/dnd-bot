const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getAllRaces } = require('../character/races');
const { getAllClasses } = require('../character/classes');

/**
 * Create race selection buttons
 * @param {string} odiscordUserId - User ID to include in button IDs
 * @returns {ActionRowBuilder[]}
 */
function createRaceButtons(odiscordUserId) {
    const races = getAllRaces();
    const rows = [];
    let currentRow = new ActionRowBuilder();

    races.forEach((race, index) => {
        if (index > 0 && index % 3 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_race_${odiscordUserId}_${race.id}`)
                .setLabel(race.name)
                .setStyle(ButtonStyle.Primary)
        );
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Create class selection buttons
 * @param {string} odiscordUserId
 * @param {string} selectedRace
 * @returns {ActionRowBuilder[]}
 */
function createClassButtons(odiscordUserId, selectedRace) {
    const classes = getAllClasses();
    const rows = [];
    let currentRow = new ActionRowBuilder();

    classes.forEach((cls, index) => {
        if (index > 0 && index % 3 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_class_${odiscordUserId}_${selectedRace}_${cls.id}`)
                .setLabel(cls.name)
                .setStyle(ButtonStyle.Primary)
        );
    });

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Create combat action buttons
 * @param {string} sessionId
 * @param {boolean} canUseAbility
 * @param {boolean} canUseItem
 * @returns {ActionRowBuilder}
 */
function createCombatButtons(sessionId, canUseAbility = true, canUseItem = true) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_attack_${sessionId}`)
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_defend_${sessionId}`)
            .setLabel('Defend')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️'),
        new ButtonBuilder()
            .setCustomId(`crawl_item_${sessionId}`)
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🧪')
            .setDisabled(!canUseItem),
        new ButtonBuilder()
            .setCustomId(`crawl_ability_${sessionId}`)
            .setLabel('Use Ability')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✨')
            .setDisabled(!canUseAbility)
    );
}

/**
 * Create target selection buttons for monsters
 * @param {string} sessionId
 * @param {object[]} monsters
 * @returns {ActionRowBuilder[]}
 */
function createTargetButtons(sessionId, monsters) {
    const rows = [];
    let currentRow = new ActionRowBuilder();

    monsters.forEach((monster, index) => {
        if (index > 0 && index % 4 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        const label = `${monster.name} (${monster.currentHp}HP)`;
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_target_${sessionId}_${monster.instanceId}`)
                .setLabel(label.substring(0, 80))
                .setStyle(ButtonStyle.Secondary)
        );
    });

    // Add cancel button
    currentRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_cancel_${sessionId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Create ability selection menu
 * @param {string} sessionId
 * @param {object[]} abilities
 * @param {object} cooldowns
 * @returns {ActionRowBuilder}
 */
function createAbilityMenu(sessionId, abilities, cooldowns = {}) {
    const options = abilities.map(ability => {
        const onCooldown = cooldowns[ability.id] > 0;
        return {
            label: ability.name,
            description: onCooldown ? `On cooldown (${cooldowns[ability.id]} turns)` : ability.description.substring(0, 100),
            value: ability.id,
            disabled: onCooldown
        };
    }).filter(opt => !opt.disabled);

    if (options.length === 0) {
        return null;
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_ability_select_${sessionId}`)
        .setPlaceholder('Select an ability')
        .addOptions(options.slice(0, 25));

    return new ActionRowBuilder().addComponents(menu);
}

/**
 * Create item selection menu
 * @param {string} sessionId
 * @param {object[]} items
 * @returns {ActionRowBuilder}
 */
function createItemMenu(sessionId, items) {
    const consumables = items.filter(item => item.type === 'consumable');

    if (consumables.length === 0) {
        return null;
    }

    const options = consumables.map((item, idx) => ({
        label: item.name,
        description: item.description ? item.description.substring(0, 100) : 'Consumable item',
        value: `${item.id}_${idx}`
    }));

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`crawl_item_select_${sessionId}`)
        .setPlaceholder('Select an item to use')
        .addOptions(options.slice(0, 25));

    return new ActionRowBuilder().addComponents(menu);
}

/**
 * Create proceed/retreat buttons after clearing a room
 * @param {string} sessionId
 * @param {boolean} isFinalRoom
 * @returns {ActionRowBuilder}
 */
function createRoomChoiceButtons(sessionId, isFinalRoom = false) {
    if (isFinalRoom) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`crawl_complete_${sessionId}`)
                .setLabel('Collect Rewards & Exit')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🏆')
        );
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_proceed_${sessionId}`)
            .setLabel('Next Room')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚪'),
        new ButtonBuilder()
            .setCustomId(`crawl_retreat_${sessionId}`)
            .setLabel('Retreat (Keep Loot)')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏃')
    );
}

/**
 * Create dungeon start button
 * @param {string} odiscordUserId
 * @returns {ActionRowBuilder}
 */
function createStartDungeonButton(odiscordUserId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_startdungeon_${odiscordUserId}`)
            .setLabel('Enter Dungeon')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_cancel_${odiscordUserId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );
}

/**
 * Create confirmation buttons
 * @param {string} sessionId
 * @param {string} action
 * @returns {ActionRowBuilder}
 */
function createConfirmButtons(sessionId, action) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_confirm_${sessionId}_${action}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`crawl_cancel_${sessionId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );
}

module.exports = {
    createRaceButtons,
    createClassButtons,
    createCombatButtons,
    createTargetButtons,
    createAbilityMenu,
    createItemMenu,
    createRoomChoiceButtons,
    createStartDungeonButton,
    createConfirmButtons
};
