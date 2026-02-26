const GRID_SIZE = 7;
const MOVEMENT_RANGE = 6; // 30ft in 5ft squares

/**
 * Create an empty combat grid
 */
function createGrid() {
    return {
        size: GRID_SIZE,
        occupancy: {} // "x,y" -> combatant id
    };
}

/**
 * Chebyshev distance (matches D&D diagonal movement)
 */
function getDistance(pos1, pos2) {
    return Math.max(
        Math.abs(pos1.x - pos2.x),
        Math.abs(pos1.y - pos2.y)
    );
}

/**
 * Convert range keyword to max grid squares
 */
function getRangeInSquares(range) {
    const rangeMap = {
        'touch': 0,
        'melee': 1,
        'reach': 2,
        'short': 6,
        'medium': 12,
        'long': 20
    };
    return rangeMap[range] ?? 1;
}

/**
 * Check if target is in range of ability
 */
function isTargetInRange(attacker, target, abilityRange) {
    if (!attacker.position || !target.position) return true;
    if (abilityRange === 'self') return true;
    if (abilityRange === 'aoe') return true;

    const distance = getDistance(attacker.position, target.position);
    return distance <= getRangeInSquares(abilityRange);
}

/**
 * Check if grid position is valid and unoccupied
 */
function isValidPosition(grid, x, y, ignoreId = null) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    const key = `${x},${y}`;
    const occupant = grid.occupancy[key];
    return !occupant || occupant === ignoreId;
}

/**
 * Get all valid move positions within movement range
 */
function getValidMovePositions(grid, currentPos, movementRange, combatantId) {
    const valid = [];
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            if (x === currentPos.x && y === currentPos.y) continue;
            const distance = getDistance(currentPos, { x, y });
            if (distance <= movementRange && isValidPosition(grid, x, y, combatantId)) {
                valid.push({ x, y, distance });
            }
        }
    }
    valid.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    return valid;
}

/**
 * Update grid occupancy when combatant moves
 */
function updateOccupancy(grid, combatantId, oldPos, newPos) {
    if (oldPos) delete grid.occupancy[`${oldPos.x},${oldPos.y}`];
    if (newPos) grid.occupancy[`${newPos.x},${newPos.y}`] = combatantId;
}

/**
 * Remove dead combatant from grid
 */
function removeFromGrid(grid, combatant) {
    if (combatant.position) {
        delete grid.occupancy[`${combatant.position.x},${combatant.position.y}`];
    }
}

/**
 * Single-char label for player class (used in grid rendering)
 */
function getPlayerLabel(classId) {
    const labels = {
        fighter: 'F', rogue: 'R', wizard: 'W',
        cleric: 'C', ranger: 'A', barbarian: 'B'
    };
    return labels[classId] || 'P';
}

/**
 * Single-char label for monster type (used in grid rendering)
 */
function getMonsterLabel(type) {
    const labels = {
        undead: 'U', demon: 'D', dragon: 'X', beast: 'V',
        humanoid: 'H', construct: 'G', animal: 'V',
        aberration: 'Q', elemental: 'E', ooze: 'O',
        outsider: 'D', plant: 'T', vermin: 'V',
        giant: 'J', magical_beast: 'M', fey: 'Y'
    };
    return labels[type] || 'M';
}

/**
 * Emoji icon for player class (used in legend)
 */
function getPlayerIcon(classId) {
    const icons = {
        fighter: '⚔️', rogue: '🗡️', wizard: '🧙',
        cleric: '📿', ranger: '🏹', barbarian: '🪓'
    };
    return icons[classId] || '🧑';
}

/**
 * Emoji icon for monster type (used in legend)
 */
function getMonsterIcon(type) {
    const icons = {
        undead: '🧟', demon: '👹', dragon: '🐉', beast: '🐺',
        humanoid: '👺', construct: '🤖', animal: '🐺',
        aberration: '👁️', elemental: '🌀', outsider: '👹',
        giant: '🗿', fey: '🧚'
    };
    return icons[type] || '👾';
}

/**
 * Render the combat grid as ASCII for a Discord code block
 */
function renderGrid(combat) {
    const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('·'));
    const legend = [];

    // Assign labels to alive players
    for (const player of combat.players) {
        if (player.position && (player.combatHp ?? player.currentHp) > 0) {
            const label = getPlayerLabel(player.class);
            grid[player.position.y][player.position.x] = label;
            legend.push(`${label}=${player.name}`);
        }
    }

    // Assign labels to alive monsters, handling duplicates with numbers
    const monsterLabels = new Map(); // label -> count
    for (const monster of combat.monsters) {
        if (monster.position && (monster.combatHp ?? monster.currentHp) > 0) {
            let baseLabel = getMonsterLabel(monster.type);
            let count = (monsterLabels.get(baseLabel) || 0) + 1;
            monsterLabels.set(baseLabel, count);

            let label;
            if (count === 1) {
                label = baseLabel;
            } else {
                label = String(count);
                // Relabel first occurrence if we now have duplicates
                if (count === 2) {
                    for (let y = 0; y < GRID_SIZE; y++) {
                        for (let x = 0; x < GRID_SIZE; x++) {
                            if (grid[y][x] === baseLabel) {
                                grid[y][x] = '1';
                                const idx = legend.findIndex(l => l.startsWith(baseLabel + '='));
                                if (idx !== -1) {
                                    legend[idx] = '1=' + legend[idx].split('=')[1];
                                }
                                break;
                            }
                        }
                    }
                }
            }
            grid[monster.position.y][monster.position.x] = label;
            legend.push(`${label}=${monster.name}`);
        }
    }

    // Build grid string
    let output = '  0 1 2 3 4 5 6\n';
    for (let y = 0; y < GRID_SIZE; y++) {
        output += `${y} ${grid[y].join(' ')}\n`;
    }
    output += '\n' + legend.join(' | ');

    return output;
}

/**
 * Render grid with movement highlights for the moving combatant
 */
function renderMovementGrid(combat, validMoves, currentPos) {
    const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('·'));

    // Mark valid move positions
    const moveSet = new Set(validMoves.map(m => `${m.x},${m.y}`));
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (moveSet.has(`${x},${y}`)) grid[y][x] = 'o';
        }
    }

    // Place combatants
    for (const player of combat.players) {
        if (player.position && (player.combatHp ?? player.currentHp) > 0) {
            grid[player.position.y][player.position.x] = getPlayerLabel(player.class);
        }
    }
    for (const monster of combat.monsters) {
        if (monster.position && (monster.combatHp ?? monster.currentHp) > 0) {
            grid[monster.position.y][monster.position.x] = getMonsterLabel(monster.type);
        }
    }

    // Mark current position
    grid[currentPos.y][currentPos.x] = '*';

    let output = '  0 1 2 3 4 5 6\n';
    for (let y = 0; y < GRID_SIZE; y++) {
        output += `${y} ${grid[y].join(' ')}\n`;
    }
    output += '\n* = You | o = Can move here';

    return output;
}

module.exports = {
    GRID_SIZE,
    MOVEMENT_RANGE,
    createGrid,
    getDistance,
    getRangeInSquares,
    isTargetInRange,
    isValidPosition,
    getValidMovePositions,
    updateOccupancy,
    removeFromGrid,
    renderGrid,
    renderMovementGrid,
    getPlayerLabel,
    getMonsterLabel,
    getPlayerIcon,
    getMonsterIcon
};
