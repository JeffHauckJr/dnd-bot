/**
 * Shop Command Handler
 * Handles ~crawl shop command and subcommands
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getCharacter } = require('../../utils/persistence');
const { getSession } = require('../../utils/crawlState');
const { getShopRotation, formatTimeUntilRotation } = require('../shop/shopState');
const { getSellPrice, getItemEmoji, formatItemStats } = require('../shop/shopManager');

/**
 * Main shop command handler
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleShop(msg, args) {
    const guildId = msg.guild.id;
    const userId = msg.author.id;

    // Check if player has a character
    const character = await getCharacter(guildId, userId);
    if (!character) {
        return msg.reply('You don\'t have a character! Use `~crawl create` to make one.');
    }

    // Check if player is in a dungeon
    const session = getSession(guildId, userId);
    if (session) {
        return msg.reply('You cannot shop while in a dungeon! Finish or retreat first.');
    }

    // Show shop overview
    return showShopOverview(msg, character, guildId, userId);
}

/**
 * Show the main shop overview with category buttons
 */
async function showShopOverview(msg, character, guildId, userId) {
    const rotation = getShopRotation(guildId);
    const timeLeft = formatTimeUntilRotation(rotation.timeUntilRotation);

    // Count items in each category
    const weaponCount = rotation.items.weapons.length;
    const armorCount = rotation.items.armor.length;
    const accessoryCount = rotation.items.accessories.length;
    const consumableCount = rotation.items.consumables.length;

    const embed = new EmbedBuilder()
        .setColor(0xDAA520) // Gold color
        .setTitle('🏪 The Wandering Merchant')
        .setDescription(
            `*"Welcome, adventurer! Take a look at my wares..."*\n\n` +
            `The merchant's stock rotates hourly. Browse while you can!\n\n` +
            `**Your Gold:** 💰 ${character.gold || 0}`
        )
        .addFields(
            { name: '⚔️ Weapons', value: `${weaponCount} available`, inline: true },
            { name: '🛡️ Armor', value: `${armorCount} available`, inline: true },
            { name: '💍 Accessories', value: `${accessoryCount} available`, inline: true },
            { name: '🧪 Consumables', value: `${consumableCount} available`, inline: true },
            { name: '💰 Sell Items', value: 'Sell for 50% value', inline: true },
            { name: '⏱️ Next Rotation', value: timeLeft, inline: true }
        )
        .setFooter({ text: 'Select a category to browse items' });

    // Category buttons
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

    return msg.reply({ embeds: [embed], components: [row1, row2] });
}

/**
 * Create category browse embed with item select menu
 * @param {object} character
 * @param {string} guildId
 * @param {string} userId
 * @param {string} category
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createCategoryEmbed(character, guildId, userId, category) {
    const rotation = getShopRotation(guildId);
    const categoryItems = rotation.items[category] || [];

    const categoryNames = {
        weapons: 'Weapons',
        armor: 'Armor',
        accessories: 'Accessories',
        consumables: 'Consumables'
    };

    const categoryEmojis = {
        weapons: '⚔️',
        armor: '🛡️',
        accessories: '💍',
        consumables: '🧪'
    };

    let itemList = '';
    if (categoryItems.length === 0) {
        itemList = '*No items available in this category*';
    } else {
        itemList = categoryItems.map(item => {
            const emoji = getItemEmoji(item.type);
            const rarity = item.rarity ? ` (${item.rarity})` : '';
            return `${emoji} **${item.name}**${rarity} - 💰 ${item.value} gold`;
        }).join('\n');
    }

    const embed = new EmbedBuilder()
        .setColor(0xDAA520)
        .setTitle(`${categoryEmojis[category]} ${categoryNames[category]} for Sale`)
        .setDescription(
            `**Your Gold:** 💰 ${character.gold || 0}\n\n` +
            itemList
        )
        .setFooter({ text: 'Select an item to view details and purchase' });

    const components = [];

    // Item select menu if there are items
    if (categoryItems.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_shopbuy_${userId}_${category}`)
            .setPlaceholder('Select an item to buy...')
            .addOptions(categoryItems.slice(0, 25).map((item, idx) => {
                let description = '';
                if (item.damage) description = `${item.damage} damage`;
                else if (item.acBonus) description = `+${item.acBonus} AC`;
                else if (item.effect?.type === 'heal') description = `Heals ${item.effect.amount}`;
                else if (item.statBonus) {
                    const stat = Object.keys(item.statBonus)[0];
                    description = `+${item.statBonus[stat]} ${stat}`;
                }
                else description = item.description?.substring(0, 50) || 'Item';

                return {
                    label: `${item.name} - ${item.value}g`,
                    description: description.substring(0, 100),
                    value: `${item.id}_${idx}`,
                    emoji: getItemEmoji(item.type)
                };
            }));

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Back button
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_shopback_${userId}`)
            .setLabel('Back to Shop')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );
    components.push(backRow);

    return { embed, components };
}

/**
 * Create item detail embed with buy confirmation
 * @param {object} character
 * @param {object} item
 * @param {string} userId
 * @param {string} category
 * @param {number} itemIndex
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createItemDetailEmbed(character, item, userId, category, itemIndex) {
    const canAfford = (character.gold || 0) >= item.value;
    const emoji = getItemEmoji(item.type);
    const stats = formatItemStats(item);

    const embed = new EmbedBuilder()
        .setColor(canAfford ? 0x00FF00 : 0xFF0000)
        .setTitle(`${emoji} ${item.name}`)
        .setDescription(item.description || 'A mysterious item.')
        .addFields(
            { name: 'Price', value: `💰 ${item.value} gold`, inline: true },
            { name: 'Your Gold', value: `💰 ${character.gold || 0}`, inline: true },
            { name: 'Type', value: item.type.charAt(0).toUpperCase() + item.type.slice(1), inline: true },
            { name: 'Stats', value: stats, inline: false }
        );

    if (item.rarity) {
        embed.addFields({ name: 'Rarity', value: item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1), inline: true });
    }

    if (!canAfford) {
        embed.setFooter({ text: '❌ You cannot afford this item!' });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_shopconfirm_${userId}_${category}_${itemIndex}`)
            .setLabel(`Buy for ${item.value}g`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰')
            .setDisabled(!canAfford),
        new ButtonBuilder()
            .setCustomId(`crawl_shopcategoryback_${userId}_${category}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );

    return { embed, components: [row] };
}

/**
 * Create sell menu embed
 * @param {object} character
 * @param {string} userId
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createSellEmbed(character, userId) {
    const inventory = character.inventory || [];

    // Filter out equipped items (they're in character.equipment, not inventory)
    const sellableItems = inventory.filter(item => item.type !== 'equipped');

    let itemList = '';
    if (sellableItems.length === 0) {
        itemList = '*Your inventory is empty!*';
    } else {
        itemList = sellableItems.slice(0, 15).map(item => {
            const emoji = getItemEmoji(item.type);
            const sellPrice = getSellPrice(item);
            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
            return `${emoji} **${item.name}**${qty} - 💰 ${sellPrice} gold`;
        }).join('\n');

        if (sellableItems.length > 15) {
            itemList += `\n*...and ${sellableItems.length - 15} more items*`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(0xDAA520)
        .setTitle('💰 Sell Items')
        .setDescription(
            `**Your Gold:** 💰 ${character.gold || 0}\n\n` +
            `*Items sell for 50% of their value.*\n\n` +
            itemList
        )
        .setFooter({ text: 'Select an item to sell' });

    const components = [];

    if (sellableItems.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`crawl_shopsellselect_${userId}`)
            .setPlaceholder('Select an item to sell...')
            .addOptions(sellableItems.slice(0, 25).map((item, idx) => {
                const sellPrice = getSellPrice(item);
                const qty = item.quantity > 1 ? ` (x${item.quantity})` : '';
                return {
                    label: `${item.name}${qty}`,
                    description: `Sell for ${sellPrice} gold`,
                    value: `${idx}`,
                    emoji: getItemEmoji(item.type)
                };
            }));

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_shopback_${userId}`)
            .setLabel('Back to Shop')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );
    components.push(backRow);

    return { embed, components };
}

/**
 * Create sell confirmation embed
 * @param {object} character
 * @param {object} item
 * @param {number} inventoryIndex
 * @param {string} userId
 * @returns {{ embed: EmbedBuilder, components: ActionRowBuilder[] }}
 */
function createSellConfirmEmbed(character, item, inventoryIndex, userId) {
    const sellPrice = getSellPrice(item);
    const emoji = getItemEmoji(item.type);

    const embed = new EmbedBuilder()
        .setColor(0xDAA520)
        .setTitle(`${emoji} Sell ${item.name}?`)
        .setDescription(
            `${item.description || 'A mysterious item.'}\n\n` +
            `**You will receive:** 💰 ${sellPrice} gold`
        )
        .setFooter({ text: 'This action cannot be undone!' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_shopsellconfirm_${userId}_${inventoryIndex}`)
            .setLabel(`Sell for ${sellPrice}g`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰'),
        new ButtonBuilder()
            .setCustomId(`crawl_shopsellback_${userId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );

    return { embed, components: [row] };
}

module.exports = {
    handleShop,
    showShopOverview,
    createCategoryEmbed,
    createItemDetailEmbed,
    createSellEmbed,
    createSellConfirmEmbed
};
