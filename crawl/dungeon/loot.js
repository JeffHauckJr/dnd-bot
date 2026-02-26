const items = require('../../data/items.json');

// Loot table tiers
const LOOT_TIERS = {
    common: { goldMult: 1, itemChance: 0.3, rarityWeights: { common: 90, uncommon: 10, rare: 0 } },
    uncommon: { goldMult: 1.5, itemChance: 0.5, rarityWeights: { common: 60, uncommon: 35, rare: 5 } },
    rare: { goldMult: 2, itemChance: 0.7, rarityWeights: { common: 30, uncommon: 50, rare: 20 } },
    boss: { goldMult: 3, itemChance: 0.9, rarityWeights: { common: 20, uncommon: 40, rare: 35, legendary: 5 } }
};

/**
 * Generate loot from a defeated monster
 * @param {object} monster - The defeated monster
 * @param {number} difficulty - Dungeon difficulty (1-5)
 * @returns {object} Generated loot
 */
function generateMonsterLoot(monster, difficulty) {
    const tier = monster.isBoss ? 'boss' : (monster.lootTable || 'common');
    const lootConfig = LOOT_TIERS[tier] || LOOT_TIERS.common;

    const loot = {
        gold: generateGold(monster.cr, lootConfig.goldMult, difficulty),
        xp: monster.xpValue,
        items: []
    };

    // Chance to drop an item
    if (Math.random() < lootConfig.itemChance) {
        const item = generateRandomItem(lootConfig.rarityWeights, difficulty);
        if (item) {
            loot.items.push(item);
        }
    }

    // Boss has chance for additional item
    if (monster.isBoss && Math.random() < 0.5) {
        const bonusItem = generateRandomItem(lootConfig.rarityWeights, difficulty);
        if (bonusItem) {
            loot.items.push(bonusItem);
        }
    }

    return loot;
}

/**
 * Generate gold based on CR and multiplier
 */
function generateGold(cr, multiplier, difficulty) {
    const baseGold = Math.max(1, Math.floor(cr * 5));
    const variance = Math.floor(Math.random() * baseGold);
    return Math.floor((baseGold + variance) * multiplier * (1 + difficulty * 0.2));
}

/**
 * Generate a random item based on rarity weights
 */
function generateRandomItem(rarityWeights, difficulty) {
    // Select rarity
    const rarity = selectRarity(rarityWeights);

    // Get all items of that rarity (or lower for common)
    const allItems = [
        ...items.weapons,
        ...items.armor,
        ...items.accessories,
        ...items.consumables
    ];

    let eligibleItems;
    if (rarity === 'common') {
        eligibleItems = allItems.filter(i => !i.rarity || i.rarity === 'common');
    } else {
        eligibleItems = allItems.filter(i => i.rarity === rarity);
    }

    // Higher chance for consumables at lower difficulties
    if (difficulty <= 2 && Math.random() < 0.6) {
        const consumables = items.consumables.filter(i =>
            !i.rarity || i.rarity === 'common' || i.rarity === rarity
        );
        if (consumables.length > 0) {
            const item = consumables[Math.floor(Math.random() * consumables.length)];
            return { ...item, quantity: 1 };
        }
    }

    if (eligibleItems.length === 0) {
        // Fallback to a health potion
        const potion = items.consumables.find(i => i.id === 'health_potion_small');
        return potion ? { ...potion, quantity: 1 } : null;
    }

    const selectedItem = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
    return {
        ...selectedItem,
        quantity: selectedItem.type === 'consumable' ? Math.floor(Math.random() * 2) + 1 : 1
    };
}

/**
 * Select rarity based on weights
 */
function selectRarity(weights) {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const [rarity, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return rarity;
    }
    return 'common';
}

/**
 * Generate treasure room loot
 * @param {number} difficulty - Dungeon difficulty
 * @returns {object} Treasure loot
 */
function generateTreasureLoot(difficulty) {
    const tier = difficulty <= 2 ? 'uncommon' : (difficulty <= 4 ? 'rare' : 'boss');
    const lootConfig = LOOT_TIERS[tier];

    const loot = {
        gold: Math.floor((20 + difficulty * 15) * lootConfig.goldMult + Math.random() * 30),
        items: []
    };

    // Guaranteed at least one item from treasure rooms
    const item = generateRandomItem(lootConfig.rarityWeights, difficulty);
    if (item) {
        loot.items.push(item);
    }

    // Chance for second item
    if (Math.random() < 0.3 + difficulty * 0.1) {
        const bonusItem = generateRandomItem(lootConfig.rarityWeights, difficulty);
        if (bonusItem) {
            loot.items.push(bonusItem);
        }
    }

    return loot;
}

/**
 * Generate end-of-dungeon bonus rewards
 * @param {number} roomsCleared - Number of rooms cleared
 * @param {number} difficulty - Dungeon difficulty
 * @returns {object} Bonus rewards
 */
function generateCompletionBonus(roomsCleared, difficulty) {
    return {
        bonusGold: Math.floor(roomsCleared * 5 * difficulty),
        bonusXp: Math.floor(roomsCleared * 10 * difficulty)
    };
}

/**
 * Consolidate loot from multiple sources
 * @param {object[]} lootArray - Array of loot objects
 * @returns {object} Consolidated loot
 */
function consolidateLoot(lootArray) {
    const consolidated = {
        gold: 0,
        xp: 0,
        items: []
    };

    for (const loot of lootArray) {
        consolidated.gold += loot.gold || 0;
        consolidated.xp += loot.xp || 0;

        if (loot.items) {
            for (const item of loot.items) {
                // Check if item already exists (for stackable items)
                const existing = consolidated.items.find(i =>
                    i.id === item.id && i.type === 'consumable'
                );
                if (existing) {
                    existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
                } else {
                    consolidated.items.push({ ...item });
                }
            }
        }
    }

    return consolidated;
}

/**
 * Add loot to a character's inventory
 * @param {object} character - The character
 * @param {object} loot - The loot to add
 * @returns {object} Updated character
 */
function addLootToCharacter(character, loot) {
    character.gold = (character.gold || 0) + (loot.gold || 0);
    character.xp = (character.xp || 0) + (loot.xp || 0);

    if (loot.items) {
        for (const item of loot.items) {
            const existing = character.inventory.find(i =>
                i.id === item.id && i.type === 'consumable'
            );
            if (existing) {
                existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
            } else {
                character.inventory.push({ ...item });
            }
        }
    }

    return character;
}

module.exports = {
    generateMonsterLoot,
    generateTreasureLoot,
    generateCompletionBonus,
    consolidateLoot,
    addLootToCharacter,
    generateRandomItem,
    LOOT_TIERS
};
