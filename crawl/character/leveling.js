const { getClass, rollHpIncrease, getNewAbilityAtLevel } = require('./classes');
const { getRacialEffects } = require('./races');

// XP thresholds for each level (3.5e style)
const xpThresholds = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000
};

// Levels where stat points are awarded
const statPointLevels = [4, 8, 12, 16, 19];

/**
 * Get XP required for a specific level
 * @param {number} level
 * @returns {number}
 */
function getXpForLevel(level) {
    return xpThresholds[level] || xpThresholds[20];
}

/**
 * Get XP required to reach the next level
 * @param {number} currentLevel
 * @returns {number}
 */
function getXpToNextLevel(currentLevel) {
    if (currentLevel >= 20) return 0;
    return xpThresholds[currentLevel + 1];
}

/**
 * Calculate what level a character should be based on XP
 * @param {number} xp
 * @returns {number}
 */
function getLevelFromXp(xp) {
    for (let level = 20; level >= 1; level--) {
        if (xp >= xpThresholds[level]) {
            return level;
        }
    }
    return 1;
}

/**
 * Check if character should level up
 * @param {number} currentLevel
 * @param {number} currentXp
 * @returns {boolean}
 */
function shouldLevelUp(currentLevel, currentXp) {
    if (currentLevel >= 20) return false;
    return currentXp >= getXpToNextLevel(currentLevel);
}

/**
 * Award XP to a character, applying racial bonuses
 * @param {object} character
 * @param {number} xpGained
 * @returns {object} - { newXp, levelsGained, levelUps }
 */
function awardXp(character, xpGained) {
    // Apply racial XP bonus if applicable
    const racialEffects = getRacialEffects(character.race);
    if (racialEffects.xpBonus) {
        xpGained = Math.floor(xpGained * (1 + racialEffects.xpBonus));
    }

    const oldLevel = character.level;
    const newXp = character.xp + xpGained;
    const newLevel = getLevelFromXp(newXp);
    const levelsGained = newLevel - oldLevel;

    const levelUps = [];
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        levelUps.push({
            level: lvl,
            hpGained: 0, // Will be calculated during level-up
            newAbility: getNewAbilityAtLevel(character.class, lvl),
            statPoints: statPointLevels.includes(lvl) ? 2 : 0
        });
    }

    return {
        xpGained,
        newXp,
        oldLevel,
        newLevel,
        levelsGained,
        levelUps
    };
}

/**
 * Apply a level up to a character
 * @param {object} character
 * @param {number} newLevel
 * @returns {object} - Updated character and level-up details
 */
function applyLevelUp(character, newLevel) {
    const { getModifier } = require('../../utils/dice');
    const racialEffects = getRacialEffects(character.race);

    // Calculate HP increase
    const conMod = getModifier(character.stats.constitution);
    let hpGained = rollHpIncrease(character.class, conMod);

    // Apply racial HP bonus
    if (racialEffects.hpPerLevel) {
        hpGained += racialEffects.hpPerLevel;
    }

    // Get new ability if any
    const newAbility = getNewAbilityAtLevel(character.class, newLevel);

    // Check for stat points
    const statPoints = statPointLevels.includes(newLevel) ? 2 : 0;

    // Update character
    character.level = newLevel;
    character.maxHp += hpGained;
    character.currentHp = character.maxHp; // Full heal on level up
    character.xpToNextLevel = getXpToNextLevel(newLevel) - character.xp;

    // Add new ability if unlocked
    if (newAbility && !character.abilities.includes(newAbility.id)) {
        character.abilities.push(newAbility.id);
    }

    // Track pending stat points
    if (statPoints > 0) {
        character.pendingStatPoints = (character.pendingStatPoints || 0) + statPoints;
    }

    return {
        character,
        levelUpInfo: {
            newLevel,
            hpGained,
            newAbility,
            statPoints,
            newMaxHp: character.maxHp
        }
    };
}

/**
 * Apply stat point increases
 * @param {object} character
 * @param {string} stat1 - First stat to increase
 * @param {string} stat2 - Second stat to increase (can be same as stat1)
 * @returns {object} - Updated character
 */
function applyStatPoints(character, stat1, stat2) {
    if (!character.pendingStatPoints || character.pendingStatPoints < 2) {
        return { success: false, error: 'No stat points available' };
    }

    const validStats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    if (!validStats.includes(stat1) || !validStats.includes(stat2)) {
        return { success: false, error: 'Invalid stat name' };
    }

    character.stats[stat1] += 1;
    character.stats[stat2] += 1;
    character.pendingStatPoints -= 2;

    // Recalculate derived stats if CON changed
    if (stat1 === 'constitution' || stat2 === 'constitution') {
        const { getModifier } = require('../../utils/dice');
        const newConMod = getModifier(character.stats.constitution);
        const hpPerLevel = character.level;
        // This is simplified - in a real game you'd track the old CON mod
        character.maxHp += (stat1 === 'constitution' ? 1 : 0) + (stat2 === 'constitution' ? 1 : 0);
        character.currentHp = Math.min(character.currentHp, character.maxHp);
    }

    return { success: true, character };
}

/**
 * Get proficiency bonus for a level
 * @param {number} level
 * @returns {number}
 */
function getProficiencyBonus(level) {
    return Math.floor((level - 1) / 4) + 2;
}

module.exports = {
    xpThresholds,
    getXpForLevel,
    getXpToNextLevel,
    getLevelFromXp,
    shouldLevelUp,
    awardXp,
    applyLevelUp,
    applyStatPoints,
    getProficiencyBonus
};
