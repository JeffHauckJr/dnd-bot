const { getModifier } = require('../../utils/dice');
const { getRacialEffects } = require('../character/races');

/**
 * Roll initiative for a combatant
 * @param {object} combatant - Character or monster
 * @param {boolean} isPlayer - Whether this is a player character
 * @returns {number} Initiative roll result
 */
function rollInitiative(combatant, isPlayer = false) {
    const d20 = Math.floor(Math.random() * 20) + 1;
    let modifier = 0;

    if (isPlayer) {
        // Player initiative = DEX mod + racial/equipment bonuses
        modifier = getModifier(combatant.stats.dexterity);

        // Check for racial initiative bonus (e.g., Elf gets +2)
        if (combatant.race) {
            const racialEffects = getRacialEffects(combatant.race);
            if (racialEffects.initiativeBonus) {
                modifier += racialEffects.initiativeBonus;
            }
        }

        // Check for equipment initiative bonus (e.g., Boots of Speed)
        if (combatant.equipment?.accessory?.initiativeBonus) {
            modifier += combatant.equipment.accessory.initiativeBonus;
        }
    } else {
        // Monster initiative = DEX mod (same as players)
        if (combatant.stats?.dexterity) {
            modifier = getModifier(combatant.stats.dexterity);
        }

        // Add explicit initiative bonus if present
        if (combatant.initiativeBonus) {
            modifier += combatant.initiativeBonus;
        }
    }

    return {
        roll: d20,
        modifier,
        total: d20 + modifier
    };
}

/**
 * Build turn order for combat
 * @param {object[]} players - Array of player characters
 * @param {object[]} monsters - Array of monster instances
 * @returns {object[]} Sorted turn order array
 */
function buildTurnOrder(players, monsters) {
    const turnOrder = [];

    // Roll for players
    for (const player of players) {
        const initiative = rollInitiative(player, true);
        turnOrder.push({
            id: player.odiscordUserId || player.id,
            odiscordUserId: player.odiscordUserId,
            name: player.name,
            isPlayer: true,
            initiative: initiative.total,
            initiativeRoll: initiative.roll,
            isAlive: true,
            hasTakenTurn: false
        });
    }

    // Roll for monsters
    for (const monster of monsters) {
        const initiative = rollInitiative(monster, false);
        turnOrder.push({
            id: monster.id,
            monsterId: monster.templateId,
            name: monster.name,
            isPlayer: false,
            initiative: initiative.total,
            initiativeRoll: initiative.roll,
            isAlive: true,
            hasTakenTurn: false
        });
    }

    // Sort by initiative (descending), with tie-breaker being the roll itself
    turnOrder.sort((a, b) => {
        if (b.initiative !== a.initiative) {
            return b.initiative - a.initiative;
        }
        // Tie-breaker: higher roll wins
        if (b.initiativeRoll !== a.initiativeRoll) {
            return b.initiativeRoll - a.initiativeRoll;
        }
        // Still tied: players go before monsters
        if (a.isPlayer !== b.isPlayer) {
            return a.isPlayer ? -1 : 1;
        }
        // Random if all else fails
        return Math.random() - 0.5;
    });

    return turnOrder;
}

/**
 * Get the current turn combatant
 * @param {object[]} turnOrder - The turn order array
 * @param {number} currentIndex - Current turn index
 * @returns {object|null} Current combatant or null
 */
function getCurrentTurn(turnOrder, currentIndex) {
    if (currentIndex >= 0 && currentIndex < turnOrder.length) {
        return turnOrder[currentIndex];
    }
    return null;
}

/**
 * Advance to next turn
 * @param {object[]} turnOrder - The turn order array
 * @param {number} currentIndex - Current turn index
 * @returns {object} New index and whether a new round started
 */
function advanceTurn(turnOrder, currentIndex) {
    // Mark current as having taken turn
    if (turnOrder[currentIndex]) {
        turnOrder[currentIndex].hasTakenTurn = true;
    }

    // Find next alive combatant
    let nextIndex = currentIndex + 1;
    let newRound = false;

    while (true) {
        if (nextIndex >= turnOrder.length) {
            // Start new round
            nextIndex = 0;
            newRound = true;
            // Reset turn taken flags
            for (const combatant of turnOrder) {
                combatant.hasTakenTurn = false;
            }
        }

        const combatant = turnOrder[nextIndex];
        if (combatant.isAlive) {
            break;
        }

        nextIndex++;

        // Safety check to prevent infinite loop if all dead
        if (nextIndex === currentIndex) {
            return { newIndex: -1, newRound: true, combatEnded: true };
        }
    }

    return { newIndex: nextIndex, newRound, combatEnded: false };
}

/**
 * Mark a combatant as dead in turn order
 * @param {object[]} turnOrder - The turn order array
 * @param {string} combatantId - ID of the combatant
 */
function markDead(turnOrder, combatantId) {
    const combatant = turnOrder.find(c => c.id === combatantId);
    if (combatant) {
        combatant.isAlive = false;
    }
}

/**
 * Mark a combatant as alive in turn order (for reviving downed players)
 * @param {object[]} turnOrder - The turn order array
 * @param {string} combatantId - ID of the combatant
 */
function markAlive(turnOrder, combatantId) {
    const combatant = turnOrder.find(c => c.id === combatantId);
    if (combatant) {
        combatant.isAlive = true;
    }
}

/**
 * Check if combat should end
 * @param {object[]} turnOrder - The turn order array
 * @returns {object} Combat end state
 */
function checkCombatEnd(turnOrder) {
    const alivePlayers = turnOrder.filter(c => c.isPlayer && c.isAlive);
    const aliveMonsters = turnOrder.filter(c => !c.isPlayer && c.isAlive);

    if (alivePlayers.length === 0) {
        return { ended: true, victory: false, reason: 'All players defeated' };
    }

    if (aliveMonsters.length === 0) {
        return { ended: true, victory: true, reason: 'All enemies defeated' };
    }

    return { ended: false, victory: null, reason: null };
}

/**
 * Format turn order for display
 * @param {object[]} turnOrder - The turn order array
 * @param {number} currentIndex - Current turn index
 * @returns {string} Formatted turn order string
 */
function formatTurnOrder(turnOrder, currentIndex) {
    return turnOrder
        .filter(c => c.isAlive)
        .map((c, i) => {
            const actualIndex = turnOrder.indexOf(c);
            const marker = actualIndex === currentIndex ? '>' : ' ';
            const type = c.isPlayer ? 'P' : 'M';
            return `${marker} [${type}] ${c.name} (${c.initiative})`;
        })
        .join('\n');
}

module.exports = {
    rollInitiative,
    buildTurnOrder,
    getCurrentTurn,
    advanceTurn,
    markDead,
    markAlive,
    checkCombatEnd,
    formatTurnOrder
};
