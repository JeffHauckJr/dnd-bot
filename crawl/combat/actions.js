const {
    processAttack,
    processDefend,
    processUseItem,
    processUseAbility,
    processMonsterTurn,
    endTurn,
    resolveCombatEnd,
    getCurrentCombatant,
    getAliveMonsters,
    getAlivePlayers
} = require('./combatManager');
const { isTargetInRange, getDistance, getRangeInSquares } = require('./grid');
const { executeMove } = require('./movement');

/**
 * Execute a player's attack action
 * @param {object} session - The dungeon session
 * @param {string} odiscordUserId - The player's Discord user ID
 * @param {string} targetId - The target monster's ID (optional)
 * @returns {object} Action result
 */
async function executeAttack(session, odiscordUserId, targetId = null) {
    const combat = session.combat;

    if (!combat || combat.status !== 'active') {
        return { success: false, message: 'No active combat.' };
    }

    const player = combat.players.find(p => p.odiscordUserId === odiscordUserId);
    if (!player) {
        return { success: false, message: 'Player not in combat.' };
    }

    // Find target (first alive monster if not specified)
    let target;
    if (targetId) {
        target = combat.monsters.find(m => m.id === targetId && (m.combatHp || m.currentHp) > 0);
    }
    if (!target) {
        target = getAliveMonsters(combat)[0];
    }

    if (!target) {
        return { success: false, message: 'No valid target.' };
    }

    // Range check for weapon attack
    const weaponRange = player.equipment?.weapon?.range || 'melee';
    if (!isTargetInRange(player, target, weaponRange)) {
        const dist = player.position && target.position ? getDistance(player.position, target.position) : '?';
        const maxRange = getRangeInSquares(weaponRange);
        return { success: false, message: `**${target.name}** is out of range! (${dist} squares away, weapon range: ${maxRange})` };
    }

    const result = processAttack(combat, player, target);
    combat.log.push(result.message);
    combat.lastAction = result;

    return {
        success: true,
        result,
        combatEnd: resolveCombatEnd(combat)
    };
}

/**
 * Execute a player's defend action
 */
async function executeDefend(session, odiscordUserId) {
    const combat = session.combat;

    if (!combat || combat.status !== 'active') {
        return { success: false, message: 'No active combat.' };
    }

    const player = combat.players.find(p => p.odiscordUserId === odiscordUserId);
    if (!player) {
        return { success: false, message: 'Player not in combat.' };
    }

    const result = processDefend(combat, player);
    combat.log.push(result.message);
    combat.lastAction = result;

    return {
        success: true,
        result
    };
}

/**
 * Execute using an item
 */
async function executeUseItem(session, odiscordUserId, itemId, targetId = null) {
    const combat = session.combat;

    if (!combat || combat.status !== 'active') {
        return { success: false, message: 'No active combat.' };
    }

    const player = combat.players.find(p => p.odiscordUserId === odiscordUserId);
    if (!player) {
        return { success: false, message: 'Player not in combat.' };
    }

    // Find item in inventory
    const item = player.inventory?.find(i => i.id === itemId);
    if (!item) {
        return { success: false, message: 'Item not found in inventory.' };
    }

    // Find target if specified
    let target = null;
    if (targetId) {
        target = combat.players.find(p => p.odiscordUserId === targetId) ||
                 combat.monsters.find(m => m.id === targetId);
    }

    const result = processUseItem(combat, player, item, target);
    combat.log.push(result.message);
    combat.lastAction = result;

    return {
        success: true,
        result,
        combatEnd: resolveCombatEnd(combat)
    };
}

/**
 * Execute using an ability
 */
async function executeUseAbility(session, odiscordUserId, abilityId, targetId = null) {
    const combat = session.combat;

    if (!combat || combat.status !== 'active') {
        return { success: false, message: 'No active combat.' };
    }

    const player = combat.players.find(p => p.odiscordUserId === odiscordUserId);
    if (!player) {
        return { success: false, message: 'Player not in combat.' };
    }

    // Find target if specified
    let target = null;
    if (targetId) {
        target = combat.players.find(p => p.odiscordUserId === targetId) ||
                 combat.monsters.find(m => m.id === targetId);
    }

    // Range check for ability
    const abilities = require('../../data/abilities.json');
    const classAbilities = abilities[player.class] || {};
    const abilityData = classAbilities[abilityId];

    if (abilityData && target && abilityData.range) {
        if (!isTargetInRange(player, target, abilityData.range)) {
            const dist = player.position && target.position ? getDistance(player.position, target.position) : '?';
            const maxRange = getRangeInSquares(abilityData.range);
            return { success: false, message: `**${target.name}** is out of range for **${abilityData.name}**! (${dist} squares away, ability range: ${maxRange})` };
        }
    }

    const result = processUseAbility(combat, player, abilityId, target);
    combat.log.push(result.message);
    combat.lastAction = result;

    if (!result.success) {
        return { success: false, message: result.message };
    }

    return {
        success: true,
        result,
        combatEnd: resolveCombatEnd(combat)
    };
}

/**
 * End player turn and process monster turns
 * @returns {object} Results of all monster actions until it's a player's turn again
 */
async function endPlayerTurn(session) {
    const combat = session.combat;

    if (!combat || combat.status !== 'active') {
        return { success: false, message: 'No active combat.' };
    }

    // Check if current player has an extra attack available (Action Surge, Frenzy)
    const currentCombatant = getCurrentCombatant(combat);
    if (currentCombatant && currentCombatant.extraAttack) {
        currentCombatant.extraAttack = false;
        return {
            success: true,
            results: [],
            extraTurn: true,
            combatEnd: { ended: false }
        };
    }

    const results = [];
    let turnResult = endTurn(combat);

    if (turnResult.ended) {
        return {
            success: true,
            results,
            combatEnd: resolveCombatEnd(combat)
        };
    }

    // Process monster turns until it's a player's turn
    while (true) {
        const currentCombatant = getCurrentCombatant(combat);

        if (!currentCombatant) break;

        // Check if combat ended
        const combatEnd = resolveCombatEnd(combat);
        if (combatEnd.ended) {
            return {
                success: true,
                results,
                combatEnd
            };
        }

        // If it's a player's turn, stop processing
        if (currentCombatant.odiscordUserId) {
            break;
        }

        // Process monster turn
        const monsterResult = processMonsterTurn(combat, currentCombatant);
        if (monsterResult) {
            results.push(monsterResult);
            combat.log.push(monsterResult.message);
        }

        // End monster turn
        turnResult = endTurn(combat);
        if (turnResult.ended) {
            return {
                success: true,
                results,
                combatEnd: resolveCombatEnd(combat)
            };
        }
    }

    return {
        success: true,
        results,
        combatEnd: resolveCombatEnd(combat)
    };
}

/**
 * Get available actions for a player
 */
function getAvailableActions(session, odiscordUserId) {
    const combat = session.combat;
    const player = combat?.players.find(p => p.odiscordUserId === odiscordUserId);

    if (!player) return null;

    const actions = {
        canAttack: true,
        canDefend: true,
        items: player.inventory?.filter(i => i.type === 'consumable') || [],
        abilities: []
    };

    // Get available abilities (not on cooldown)
    const abilities = require('../../data/abilities.json');
    const classAbilities = abilities[player.class] || {};

    for (const abilityId of (player.abilities || [])) {
        const ability = classAbilities[abilityId];
        if (ability) {
            const cooldown = player.cooldowns?.[abilityId] || 0;
            actions.abilities.push({
                id: abilityId,
                name: ability.name,
                description: ability.description,
                cooldown,
                ready: cooldown === 0
            });
        }
    }

    return actions;
}

/**
 * Get current targets for selection
 */
function getTargets(session, forAbility = null) {
    const combat = session.combat;
    if (!combat) return { enemies: [], allies: [] };

    const abilities = require('../../data/abilities.json');

    // Default to enemies
    let enemies = getAliveMonsters(combat).map(m => ({
        id: m.id,
        name: m.name,
        hp: m.combatHp || m.currentHp,
        maxHp: m.maxHp
    }));

    let allies = getAlivePlayers(combat).map(p => ({
        id: p.odiscordUserId,
        name: p.name,
        hp: p.combatHp || p.currentHp,
        maxHp: p.maxHp
    }));

    return { enemies, allies };
}

/**
 * Execute a player's movement action
 */
async function executeMovement(session, odiscordUserId, newPos) {
    const combat = session.combat;

    if (!combat || combat.status !== 'active') {
        return { success: false, message: 'No active combat.' };
    }

    const result = executeMove(combat, odiscordUserId, newPos);
    if (result.success) {
        combat.log.push(`**${combat.players.find(p => p.odiscordUserId === odiscordUserId)?.name || 'Player'}** ${result.message}`);
    }

    return result;
}

module.exports = {
    executeAttack,
    executeDefend,
    executeUseItem,
    executeUseAbility,
    executeMovement,
    endPlayerTurn,
    getAvailableActions,
    getTargets
};
