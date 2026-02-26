/**
 * Shop Manager
 * Handles rotation generation, buying, and selling logic
 */

const items = require('../../data/items.json');

// Rarity weights for random selection (higher = more common)
const RARITY_WEIGHTS = {
    common: 10,
    uncommon: 5,
    rare: 2,
    legendary: 1
};

/**
 * Get rarity weight for an item
 * @param {object} item
 * @returns {number}
 */
function getRarityWeight(item) {
    return RARITY_WEIGHTS[item.rarity] || RARITY_WEIGHTS.common;
}

/**
 * Pick random items from an array with rarity weighting
 * @param {object[]} itemArray
 * @param {number} count
 * @returns {object[]}
 */
function pickWeightedRandom(itemArray, count) {
    if (itemArray.length <= count) {
        return [...itemArray];
    }

    // Build weighted pool
    const weightedPool = [];
    for (const item of itemArray) {
        const weight = getRarityWeight(item);
        for (let i = 0; i < weight; i++) {
            weightedPool.push(item);
        }
    }

    // Pick unique items
    const selected = [];
    const usedIds = new Set();

    while (selected.length < count && weightedPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * weightedPool.length);
        const item = weightedPool[randomIndex];

        if (!usedIds.has(item.id)) {
            selected.push(item);
            usedIds.add(item.id);
        }

        // Remove all instances of this item from pool
        for (let i = weightedPool.length - 1; i >= 0; i--) {
            if (weightedPool[i].id === item.id) {
                weightedPool.splice(i, 1);
            }
        }
    }

    return selected;
}

/**
 * Generate a new shop rotation
 * @returns {{ weapons: object[], armor: object[], accessories: object[], consumables: object[] }}
 */
function generateRotation() {
    return {
        weapons: pickWeightedRandom(items.weapons, 4),
        armor: pickWeightedRandom(items.armor, 3),
        accessories: pickWeightedRandom(items.accessories, 2),
        consumables: pickWeightedRandom(items.consumables, 3)
    };
}

/**
 * Calculate sell price for an item (50% of value)
 * @param {object} item
 * @returns {number}
 */
function getSellPrice(item) {
    return Math.floor((item.value || 0) / 2);
}

/**
 * Attempt to buy an item
 * @param {object} character
 * @param {object} item
 * @returns {{ success: boolean, message: string }}
 */
function buyItem(character, item) {
    const price = item.value || 0;

    if ((character.gold || 0) < price) {
        return {
            success: false,
            message: `Not enough gold! You have **${character.gold || 0}** gold but need **${price}** gold.`
        };
    }

    // Deduct gold
    character.gold = (character.gold || 0) - price;

    // Add item to inventory
    addItemToInventory(character, item);

    return {
        success: true,
        message: `Purchased **${item.name}** for **${price}** gold!`
    };
}

/**
 * Sell an item from inventory
 * @param {object} character
 * @param {number} inventoryIndex - Index in character.inventory
 * @returns {{ success: boolean, message: string, goldReceived: number }}
 */
function sellItem(character, inventoryIndex) {
    const inventory = character.inventory || [];

    if (inventoryIndex < 0 || inventoryIndex >= inventory.length) {
        return {
            success: false,
            message: 'Item not found in inventory.',
            goldReceived: 0
        };
    }

    const item = inventory[inventoryIndex];
    const sellPrice = getSellPrice(item);

    // Add gold
    character.gold = (character.gold || 0) + sellPrice;

    // Remove item from inventory
    if (item.type === 'consumable' && item.quantity > 1) {
        item.quantity--;
    } else {
        inventory.splice(inventoryIndex, 1);
    }

    return {
        success: true,
        message: `Sold **${item.name}** for **${sellPrice}** gold!`,
        goldReceived: sellPrice
    };
}

/**
 * Add an item to character's inventory
 * @param {object} character
 * @param {object} item
 */
function addItemToInventory(character, item) {
    if (!character.inventory) {
        character.inventory = [];
    }

    // For consumables, stack if already have one
    if (item.type === 'consumable') {
        const existing = character.inventory.find(i => i.id === item.id);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
            return;
        }
    }

    // Add new item (with quantity 1 for consumables)
    const newItem = { ...item };
    if (newItem.type === 'consumable') {
        newItem.quantity = 1;
    }
    character.inventory.push(newItem);
}

/**
 * Get all items from items.json organized by category
 * @returns {{ weapons: object[], armor: object[], accessories: object[], consumables: object[] }}
 */
function getAllItems() {
    return {
        weapons: items.weapons,
        armor: items.armor,
        accessories: items.accessories,
        consumables: items.consumables
    };
}

/**
 * Find an item by ID across all categories
 * @param {string} itemId
 * @returns {object|null}
 */
function findItemById(itemId) {
    const allCategories = [items.weapons, items.armor, items.accessories, items.consumables];

    for (const category of allCategories) {
        const found = category.find(item => item.id === itemId);
        if (found) return found;
    }

    return null;
}

/**
 * Get item emoji based on type
 * @param {string} type
 * @returns {string}
 */
function getItemEmoji(type) {
    switch (type) {
        case 'weapon': return '⚔️';
        case 'armor': return '🛡️';
        case 'accessory': return '💍';
        case 'consumable': return '🧪';
        default: return '📦';
    }
}

/**
 * Get rarity color for embeds
 * @param {string} rarity
 * @returns {number}
 */
function getRarityColor(rarity) {
    switch (rarity) {
        case 'uncommon': return 0x1EFF00; // Green
        case 'rare': return 0x0070DD;     // Blue
        case 'legendary': return 0xFF8000; // Orange
        default: return 0x9D9D9D;          // Gray (common)
    }
}

/**
 * Format item stats for display
 * @param {object} item
 * @returns {string}
 */
function formatItemStats(item) {
    const stats = [];

    if (item.damage) stats.push(`Damage: ${item.damage}`);
    if (item.damageType) stats.push(`Type: ${item.damageType}`);
    if (item.toHitBonus) stats.push(`To Hit: +${item.toHitBonus}`);
    if (item.acBonus) stats.push(`AC: +${item.acBonus}`);
    if (item.properties?.length) stats.push(`Properties: ${item.properties.join(', ')}`);
    if (item.statBonus) {
        const stat = Object.keys(item.statBonus)[0];
        stats.push(`+${item.statBonus[stat]} ${stat}`);
    }
    if (item.initiativeBonus) stats.push(`Initiative: +${item.initiativeBonus}`);
    if (item.effect) {
        if (item.effect.type === 'heal') stats.push(`Heals: ${item.effect.amount}`);
        if (item.effect.type === 'damage') stats.push(`Damage: ${item.effect.amount} ${item.effect.damageType || ''}`);
        if (item.effect.type === 'regen') stats.push(`Regen: ${item.effect.amount}/turn`);
    }
    if (item.resistances?.length) stats.push(`Resists: ${item.resistances.join(', ')}`);

    return stats.join('\n') || 'No special properties';
}

module.exports = {
    generateRotation,
    buyItem,
    sellItem,
    getSellPrice,
    addItemToInventory,
    getAllItems,
    findItemById,
    getItemEmoji,
    getRarityColor,
    formatItemStats
};
