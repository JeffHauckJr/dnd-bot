const { getDistance, getValidMovePositions, updateOccupancy, GRID_SIZE, MOVEMENT_RANGE } = require('./grid');

/**
 * Determine combat role based on class (for starting positions)
 */
function getCombatRole(classId) {
    const meleeClasses = ['fighter', 'barbarian'];
    return meleeClasses.includes(classId) ? 'melee' : 'ranged';
}

/**
 * Check if a monster has ranged attacks
 */
function hasRangedAttack(monster) {
    return monster.attacks?.some(a => {
        const name = (a.name || '').toLowerCase();
        const range = (a.range || '').toLowerCase();
        return range === 'short' || range === 'medium' || range === 'long' ||
            name.includes('bow') || name.includes('javelin') ||
            name.includes('sling') || name.includes('crossbow') ||
            name.includes('ray') || name.includes('bolt') ||
            name.includes('breath');
    });
}

/**
 * Assign starting positions to all combatants
 * Players: melee in front (y=5), ranged in back (y=6)
 * Monsters: ranged in back (y=0), melee in front (y=1)
 */
function assignStartingPositions(combat) {
    const { players, monsters, grid } = combat;

    // Split players by role
    const melee = players.filter(p => getCombatRole(p.class) === 'melee');
    const ranged = players.filter(p => getCombatRole(p.class) === 'ranged');

    // Center party horizontally
    const totalPlayers = players.length;
    let xStart = Math.max(0, Math.floor((GRID_SIZE - totalPlayers) / 2));

    // Place melee players in front row (y=5)
    melee.forEach((player, i) => {
        const x = Math.min(xStart + i, GRID_SIZE - 1);
        player.position = { x, y: 5 };
        player.combatRole = 'melee';
        player.movementRemaining = MOVEMENT_RANGE;
        updateOccupancy(grid, player.odiscordUserId, null, player.position);
    });

    // Place ranged players in back row (y=6)
    ranged.forEach((player, i) => {
        const x = Math.min(xStart + melee.length + i, GRID_SIZE - 1);
        player.position = { x, y: 6 };
        player.combatRole = 'ranged';
        player.movementRemaining = MOVEMENT_RANGE;
        updateOccupancy(grid, player.odiscordUserId, null, player.position);
    });

    // Split monsters by role
    const monsterMelee = [];
    const monsterRanged = [];
    monsters.forEach(m => {
        if (hasRangedAttack(m)) {
            monsterRanged.push(m);
        } else {
            monsterMelee.push(m);
        }
    });

    const totalMonsters = monsters.length;
    xStart = Math.max(0, Math.floor((GRID_SIZE - totalMonsters) / 2));

    // Place ranged monsters in back (y=0)
    monsterRanged.forEach((monster, i) => {
        const x = Math.min(xStart + i, GRID_SIZE - 1);
        monster.position = { x, y: 0 };
        monster.movementRemaining = MOVEMENT_RANGE;
        updateOccupancy(grid, monster.id, null, monster.position);
    });

    // Place melee monsters in front (y=1)
    monsterMelee.forEach((monster, i) => {
        const x = Math.min(xStart + monsterRanged.length + i, GRID_SIZE - 1);
        monster.position = { x, y: 1 };
        monster.movementRemaining = MOVEMENT_RANGE;
        updateOccupancy(grid, monster.id, null, monster.position);
    });
}

/**
 * Execute a move for a combatant
 */
function executeMove(combat, combatantId, newPos) {
    const combatant = [...combat.players, ...combat.monsters].find(c =>
        c.odiscordUserId === combatantId || c.id === combatantId
    );

    if (!combatant || !combatant.position) {
        return { success: false, message: 'Combatant not found.' };
    }

    const distance = getDistance(combatant.position, newPos);
    const remaining = combatant.movementRemaining ?? MOVEMENT_RANGE;

    if (distance > remaining) {
        return { success: false, message: `Not enough movement! Need ${distance} but only ${remaining} remaining.` };
    }

    const oldPos = { ...combatant.position };
    combatant.position = { x: newPos.x, y: newPos.y };
    combatant.movementRemaining = remaining - distance;

    updateOccupancy(combat.grid, combatantId, oldPos, combatant.position);

    return {
        success: true,
        message: `Moved ${distance} square${distance !== 1 ? 's' : ''} to (${newPos.x}, ${newPos.y}). ${combatant.movementRemaining} movement remaining.`,
        distance,
        remaining: combatant.movementRemaining
    };
}

/**
 * Reset movement for a combatant at start of their turn
 */
function resetMovement(combatant) {
    combatant.movementRemaining = MOVEMENT_RANGE;
}

/**
 * Monster AI: Move toward nearest player (for melee) or away (for ranged)
 */
function monsterMovement(combat, monster) {
    const alivePlayers = combat.players.filter(p => (p.combatHp ?? p.currentHp) > 0);
    if (alivePlayers.length === 0) return null;

    // Find nearest player
    let nearestPlayer = null;
    let nearestDist = Infinity;
    for (const player of alivePlayers) {
        if (!player.position) continue;
        const dist = getDistance(monster.position, player.position);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestPlayer = player;
        }
    }

    if (!nearestPlayer) return null;

    const isRanged = hasRangedAttack(monster);
    const validMoves = getValidMovePositions(
        combat.grid, monster.position, monster.movementRemaining ?? MOVEMENT_RANGE, monster.id
    );

    if (validMoves.length === 0) return null;

    let bestMove = null;

    if (isRanged && nearestDist <= 1) {
        // Ranged monster too close - move away
        let maxDist = nearestDist;
        for (const move of validMoves) {
            const dist = getDistance(move, nearestPlayer.position);
            if (dist > maxDist) {
                maxDist = dist;
                bestMove = move;
            }
        }
    } else if (!isRanged && nearestDist > 1) {
        // Melee monster too far - move closer
        let minDist = nearestDist;
        for (const move of validMoves) {
            const dist = getDistance(move, nearestPlayer.position);
            if (dist < minDist) {
                minDist = dist;
                bestMove = move;
            }
        }
    }

    if (bestMove) {
        return executeMove(combat, monster.id, bestMove);
    }

    return null;
}

/**
 * Select best attack for monster considering range
 */
function selectAttackInRange(monster, target) {
    if (!monster.attacks || monster.attacks.length === 0) return null;
    if (!monster.position || !target.position) return monster.attacks[0];

    const dist = getDistance(monster.position, target.position);

    // Find attacks that are in range
    const { getRangeInSquares } = require('./grid');
    const inRange = monster.attacks.filter(a => {
        const range = a.range || 'melee';
        return dist <= getRangeInSquares(range);
    });

    if (inRange.length > 0) {
        // Pick highest damage attack in range
        return inRange.reduce((best, a) => {
            const bestDmg = parseInt(best.damage) || 0;
            const aDmg = parseInt(a.damage) || 0;
            return aDmg > bestDmg ? a : best;
        }, inRange[0]);
    }

    return null; // No attack in range
}

module.exports = {
    getCombatRole,
    hasRangedAttack,
    assignStartingPositions,
    executeMove,
    resetMovement,
    monsterMovement,
    selectAttackInRange
};
