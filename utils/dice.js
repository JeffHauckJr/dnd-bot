/**
 * Roll a single die of the specified size
 * @param {number} sides - Number of sides on the die
 * @returns {number} - Roll result (1 to sides)
 */
function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice
 * @param {number} count - Number of dice to roll
 * @param {number} sides - Number of sides per die
 * @returns {number[]} - Array of individual roll results
 */
function rollDice(count, sides) {
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(rollDie(sides));
    }
    return rolls;
}

/**
 * Roll dice and return total
 * @param {number} count - Number of dice
 * @param {number} sides - Sides per die
 * @param {number} modifier - Bonus to add to total
 * @returns {object} - { rolls: number[], total: number }
 */
function roll(count, sides, modifier = 0) {
    const rolls = rollDice(count, sides);
    const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
    return { rolls, total };
}

/**
 * Parse a dice string like "2d6+3" or "1d20-2"
 * @param {string} diceString - Dice notation string
 * @returns {object} - { count, sides, modifier }
 */
function parseDiceString(diceString) {
    const match = diceString.toLowerCase().match(/^(\d+)d(\d+)([+-]\d+)?$/);
    if (!match) return null;

    return {
        count: parseInt(match[1]),
        sides: parseInt(match[2]),
        modifier: match[3] ? parseInt(match[3]) : 0
    };
}

/**
 * Roll from a dice string like "2d6+3"
 * @param {string} diceString - Dice notation
 * @returns {object} - { rolls, total, notation }
 */
function rollFromString(diceString) {
    const parsed = parseDiceString(diceString);
    if (!parsed) return null;

    const result = roll(parsed.count, parsed.sides, parsed.modifier);
    return {
        ...result,
        notation: diceString
    };
}

/**
 * Roll a d20 (common operation)
 * @returns {number}
 */
function d20() {
    return rollDie(20);
}

/**
 * Roll initiative (d20 + dex modifier)
 * @param {number} dexMod - Dexterity modifier
 * @param {number} bonus - Additional initiative bonus
 * @returns {object} - { roll, modifier, total }
 */
function rollInitiative(dexMod = 0, bonus = 0) {
    const dieRoll = d20();
    return {
        roll: dieRoll,
        modifier: dexMod + bonus,
        total: dieRoll + dexMod + bonus
    };
}

/**
 * Roll an attack (d20 + attack bonus vs AC)
 * @param {number} attackBonus - Attack modifier
 * @param {number} targetAC - Target's armor class
 * @returns {object} - { roll, total, hit, crit, fumble }
 */
function rollAttack(attackBonus, targetAC) {
    const dieRoll = d20();
    const total = dieRoll + attackBonus;

    return {
        roll: dieRoll,
        total,
        hit: dieRoll === 20 || (dieRoll !== 1 && total >= targetAC),
        crit: dieRoll === 20,
        fumble: dieRoll === 1
    };
}

/**
 * Roll damage from a damage string, with optional crit doubling
 * @param {string} damageString - Damage notation like "2d6+3"
 * @param {boolean} isCrit - Whether to double dice on crit
 * @returns {object} - { rolls, total, notation }
 */
function rollDamage(damageString, isCrit = false) {
    const parsed = parseDiceString(damageString);
    if (!parsed) return null;

    const diceCount = isCrit ? parsed.count * 2 : parsed.count;
    const result = roll(diceCount, parsed.sides, parsed.modifier);

    return {
        ...result,
        notation: damageString,
        crit: isCrit
    };
}

/**
 * Roll ability scores using 4d6 drop lowest
 * @returns {number} - Single ability score
 */
function rollAbilityScore() {
    const rolls = rollDice(4, 6);
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2]; // Sum top 3
}

/**
 * Generate a full set of ability scores
 * @returns {number[]} - Array of 6 ability scores
 */
function rollAbilityScores() {
    return Array(6).fill(0).map(() => rollAbilityScore());
}

/**
 * Calculate ability modifier from score
 * @param {number} score - Ability score (1-30)
 * @returns {number} - Modifier
 */
function getModifier(score) {
    return Math.floor((score - 10) / 2);
}

/**
 * Roll dice from a string notation and return just the total
 * Handles formats like "1d8", "2d6+3", "1d4-2", "1d8+1d6", "1d10+level"
 * @param {string} diceString - Dice notation
 * @returns {number} - Total roll result
 */
function rollDiceTotal(diceString) {
    if (typeof diceString === 'number') return diceString;
    if (!diceString) return 0;

    // Tokenize: split on + and - while keeping the sign
    // "1d8+1d6-2" -> ["1d8", "+1d6", "-2"]
    const tokens = diceString.match(/[+-]?[^+-]+/g) || [];
    let total = 0;

    for (const token of tokens) {
        const trimmed = token.trim();

        // Check if it's a dice notation (possibly with sign), e.g. "2d6", "-1d4", "+1d8"
        const diceMatch = trimmed.match(/^([+-]?)(\d+)d(\d+)$/i);
        if (diceMatch) {
            const sign = diceMatch[1] === '-' ? -1 : 1;
            const count = parseInt(diceMatch[2]);
            const sides = parseInt(diceMatch[3]);
            for (let i = 0; i < count; i++) {
                total += sign * rollDie(sides);
            }
            continue;
        }

        // Check if it's just a number (possibly with sign)
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
            total += num;
            continue;
        }

        // Unknown format, skip
    }

    return Math.max(0, total);
}

module.exports = {
    rollDie,
    rollDice,
    roll,
    parseDiceString,
    rollFromString,
    d20,
    rollInitiative,
    rollAttack,
    rollDamage,
    rollAbilityScore,
    rollAbilityScores,
    getModifier,
    rollDiceTotal
};
