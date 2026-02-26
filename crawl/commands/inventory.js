const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCharacter, saveCharacter } = require('../../utils/persistence');
const { getModifier } = require('../../utils/dice');

/**
 * Handle ~crawl inventory command
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleInventory(msg, args) {
    const guildId = msg.guild.id;
    const userId = msg.author.id;

    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You don\'t have a character! Use `~crawl create` to make one.');
    }

    const embed = createInventoryEmbed(character);
    const components = createInventoryComponents(character, userId);

    await msg.reply({ embeds: [embed], components });
}

/**
 * Create inventory embed
 */
function createInventoryEmbed(character, resultMessage = null) {
    const inventory = character.inventory || [];

    const weapons = inventory.filter(i => i.type === 'weapon');
    const armor = inventory.filter(i => i.type === 'armor');
    const accessories = inventory.filter(i => i.type === 'accessory');
    const consumables = inventory.filter(i => i.type === 'consumable');

    let description = resultMessage ? resultMessage + '\n\n' : '';

    // Equipped items
    if (character.equipment?.weapon) {
        description += `**Equipped Weapon:** ⚔️ ${character.equipment.weapon.name} (${character.equipment.weapon.damage})\n`;
    } else {
        description += `**Equipped Weapon:** *None*\n`;
    }
    if (character.equipment?.armor) {
        description += `**Equipped Armor:** 🛡️ ${character.equipment.armor.name} (AC +${character.equipment.armor.acBonus})\n`;
    } else {
        description += `**Equipped Armor:** *None*\n`;
    }
    if (character.equipment?.accessory) {
        const acc = character.equipment.accessory;
        let accDesc = acc.name;
        if (acc.acBonus) accDesc += ` (AC +${acc.acBonus})`;
        if (acc.statBonus) accDesc += ` (+${Object.values(acc.statBonus)[0]} ${Object.keys(acc.statBonus)[0]})`;
        if (acc.initiativeBonus) accDesc += ` (+${acc.initiativeBonus} init)`;
        if (acc.effect?.type === 'regen') accDesc += ` (regen ${acc.effect.amount}/turn)`;
        description += `**Equipped Accessory:** 💍 ${accDesc}\n`;
    } else {
        description += `**Equipped Accessory:** *None*\n`;
    }

    description += `\n**Gold:** ${character.gold || 0}\n`;
    description += `**HP:** ${character.currentHp}/${character.maxHp}\n`;
    description += `**AC:** ${character.ac || character.armorClass || 10}\n\n`;

    if (weapons.length > 0) {
        description += `**Weapons (${weapons.length}):**\n`;
        description += weapons.map(w => `⚔️ ${w.name} (${w.damage} ${w.damageType || ''})`).join('\n') + '\n\n';
    }

    if (armor.length > 0) {
        description += `**Armor (${armor.length}):**\n`;
        description += armor.map(a => `🛡️ ${a.name} (AC +${a.acBonus})`).join('\n') + '\n\n';
    }

    if (accessories.length > 0) {
        description += `**Accessories (${accessories.length}):**\n`;
        description += accessories.map(a => {
            let desc = `💍 ${a.name}`;
            if (a.acBonus) desc += ` (AC +${a.acBonus})`;
            if (a.statBonus) desc += ` (+${Object.values(a.statBonus)[0]} ${Object.keys(a.statBonus)[0]})`;
            if (a.initiativeBonus) desc += ` (+${a.initiativeBonus} init)`;
            return desc;
        }).join('\n') + '\n\n';
    }

    if (consumables.length > 0) {
        description += `**Consumables (${consumables.length}):**\n`;
        description += consumables.map(c => `🧪 ${c.name}${c.quantity > 1 ? ` x${c.quantity}` : ''}`).join('\n');
    }

    if (inventory.length === 0 && !character.equipment?.weapon && !character.equipment?.armor && !character.equipment?.accessory) {
        description += '*Your inventory is empty.*';
    }

    const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle(`🎒 ${character.name}'s Inventory`)
        .setDescription(description)
        .setFooter({ text: 'Use the menus below to equip items' });

    return embed;
}

/**
 * Create inventory components (menus and buttons)
 */
function createInventoryComponents(character, odiscordUserId) {
    const inventory = character.inventory || [];
    const weapons = inventory.filter(i => i.type === 'weapon');
    const armor = inventory.filter(i => i.type === 'armor');
    const accessories = inventory.filter(i => i.type === 'accessory');
    const consumables = inventory.filter(i => i.type === 'consumable');

    const rows = [];

    // Equip weapon menu
    if (weapons.length > 0) {
        const weaponMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_invequip_weapon_${odiscordUserId}`)
            .setPlaceholder('Equip a weapon...')
            .addOptions(weapons.slice(0, 25).map((item, idx) => ({
                label: item.name,
                description: `${item.damage} ${item.damageType || ''}`.trim(),
                value: `${item.id}_${idx}`,
                emoji: '⚔️'
            })));
        rows.push(new ActionRowBuilder().addComponents(weaponMenu));
    }

    // Equip armor menu
    if (armor.length > 0) {
        const armorMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_invequip_armor_${odiscordUserId}`)
            .setPlaceholder('Equip armor...')
            .addOptions(armor.slice(0, 25).map((item, idx) => ({
                label: item.name,
                description: `AC +${item.acBonus}`,
                value: `${item.id}_${idx}`,
                emoji: '🛡️'
            })));
        rows.push(new ActionRowBuilder().addComponents(armorMenu));
    }

    // Equip accessory menu
    if (accessories.length > 0) {
        const accessoryMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_invequip_accessory_${odiscordUserId}`)
            .setPlaceholder('Equip an accessory...')
            .addOptions(accessories.slice(0, 25).map((item, idx) => {
                let desc = '';
                if (item.acBonus) desc += `AC +${item.acBonus} `;
                if (item.statBonus) desc += `+${Object.values(item.statBonus)[0]} ${Object.keys(item.statBonus)[0]} `;
                if (item.initiativeBonus) desc += `+${item.initiativeBonus} init `;
                if (item.effect?.type === 'regen') desc += `regen ${item.effect.amount}/turn `;
                return {
                    label: item.name,
                    description: desc.trim() || item.description?.substring(0, 100) || 'An accessory',
                    value: `${item.id}_${idx}`,
                    emoji: '💍'
                };
            }));
        rows.push(new ActionRowBuilder().addComponents(accessoryMenu));
    }

    // Use consumable menu (for healing outside dungeon)
    if (consumables.length > 0) {
        const useMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_invuse_${odiscordUserId}`)
            .setPlaceholder('Use an item...')
            .addOptions(consumables.slice(0, 25).map((item, idx) => ({
                label: `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`,
                description: item.description?.substring(0, 100) || 'A consumable item',
                value: `${item.id}_${idx}`,
                emoji: '🧪'
            })));
        rows.push(new ActionRowBuilder().addComponents(useMenu));
    }

    return rows;
}

module.exports = {
    handleInventory,
    createInventoryEmbed,
    createInventoryComponents
};
