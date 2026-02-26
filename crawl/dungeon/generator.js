const monsters = require('../../data/monsters.json');

// Room types and their weights
const ROOM_TYPES = {
    combat: 50,
    treasure: 15,
    trap: 10,
    rest: 10,
    empty: 10,
    boss: 5 // Only for final room
};

/**
 * Generate a dungeon based on party level
 * @param {number} partyLevel - Average level of the party
 * @param {number} partySize - Number of players
 * @returns {object} Generated dungeon
 */
function generateDungeon(partyLevel, partySize = 1) {
    const difficulty = calculateDifficulty(partyLevel);
    const roomCount = calculateRoomCount(difficulty);

    const dungeon = {
        id: `dungeon_${Date.now()}`,
        difficulty,
        totalRooms: roomCount,
        currentRoom: 0,
        rooms: [],
        completed: false,
        rewards: {
            totalXp: 0,
            totalGold: 0,
            items: []
        }
    };

    // Generate rooms
    for (let i = 0; i < roomCount; i++) {
        const isLastRoom = i === roomCount - 1;
        const room = generateRoom(i, difficulty, partyLevel, partySize, isLastRoom);
        dungeon.rooms.push(room);
    }

    return dungeon;
}

/**
 * Calculate difficulty tier (1-5) based on party level
 */
function calculateDifficulty(partyLevel) {
    if (partyLevel <= 2) return 1;
    if (partyLevel <= 4) return 2;
    if (partyLevel <= 7) return 3;
    if (partyLevel <= 10) return 4;
    return 5;
}

/**
 * Calculate number of rooms based on difficulty
 */
function calculateRoomCount(difficulty) {
    const base = 4 + difficulty;
    const variance = Math.floor(Math.random() * 3) - 1; // -1 to +1
    return Math.max(5, Math.min(15, base + variance));
}

/**
 * Generate a single room
 */
function generateRoom(roomIndex, difficulty, partyLevel, partySize, isBossRoom) {
    const roomType = isBossRoom ? 'boss' : selectRoomType();

    const room = {
        index: roomIndex,
        type: roomType,
        name: generateRoomName(roomType),
        description: generateRoomDescription(roomType),
        cleared: false,
        monsters: [],
        loot: null,
        trap: null
    };

    switch (roomType) {
        case 'combat':
            room.monsters = generateEncounter(difficulty, partyLevel, partySize, false);
            break;
        case 'boss':
            room.monsters = generateEncounter(difficulty, partyLevel, partySize, true);
            room.name = 'Boss Chamber';
            room.description = 'A massive chamber awaits. Something powerful lurks within...';
            break;
        case 'treasure':
            room.loot = generateTreasure(difficulty);
            break;
        case 'trap':
            room.trap = generateTrap(difficulty);
            break;
        case 'rest':
            room.healAmount = Math.floor(10 + (difficulty * 5) + Math.random() * 10);
            break;
        case 'empty':
            // Empty room - maybe flavor text
            break;
    }

    return room;
}

/**
 * Select room type based on weights
 */
function selectRoomType() {
    const totalWeight = Object.values(ROOM_TYPES).reduce((a, b) => a + b, 0) - ROOM_TYPES.boss;
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(ROOM_TYPES)) {
        if (type === 'boss') continue;
        random -= weight;
        if (random <= 0) return type;
    }
    return 'combat';
}

/**
 * Generate monster encounter
 */
function generateEncounter(difficulty, partyLevel, partySize, isBoss) {
    const encounter = [];

    // Filter monsters by CR appropriate for difficulty
    const crRange = getCRRange(difficulty, isBoss);
    const eligibleMonsters = monsters.filter(m =>
        m.challengeRating >= crRange.min && m.challengeRating <= crRange.max
    );

    if (eligibleMonsters.length === 0) {
        // Fallback to any low-level monster
        const fallback = monsters.find(m => m.challengeRating <= 1) || monsters[0];
        encounter.push(createMonsterInstance(fallback));
        return encounter;
    }

    if (isBoss) {
        // Boss encounter: 1 strong monster + maybe minions
        const bossMonsters = eligibleMonsters.filter(m => m.challengeRating >= crRange.max - 1);
        const boss = bossMonsters[Math.floor(Math.random() * bossMonsters.length)] || eligibleMonsters[0];
        encounter.push(createMonsterInstance(boss, true));

        // 50% chance for minions
        if (Math.random() < 0.5) {
            const minionCount = Math.floor(Math.random() * 2) + 1;
            const minionCR = Math.max(0.25, crRange.min);
            const minionOptions = monsters.filter(m => m.challengeRating <= minionCR);
            if (minionOptions.length > 0) {
                for (let i = 0; i < minionCount; i++) {
                    const minion = minionOptions[Math.floor(Math.random() * minionOptions.length)];
                    encounter.push(createMonsterInstance(minion));
                }
            }
        }
    } else {
        // Regular encounter: 1-4 monsters based on party size
        const monsterCount = Math.min(4, Math.max(1, partySize + Math.floor(Math.random() * 2)));

        for (let i = 0; i < monsterCount; i++) {
            const monster = eligibleMonsters[Math.floor(Math.random() * eligibleMonsters.length)];
            encounter.push(createMonsterInstance(monster));
        }
    }

    return encounter;
}

/**
 * Get CR range for difficulty tier
 */
function getCRRange(difficulty, isBoss) {
    const ranges = {
        1: { min: 0.125, max: isBoss ? 2 : 0.5 },
        2: { min: 0.25, max: isBoss ? 4 : 1 },
        3: { min: 0.5, max: isBoss ? 6 : 2 },
        4: { min: 1, max: isBoss ? 8 : 4 },
        5: { min: 2, max: isBoss ? 10 : 6 }
    };
    return ranges[difficulty] || ranges[1];
}

/**
 * Create a monster instance for combat
 */
function createMonsterInstance(monsterData, isBoss = false) {
    const hpMultiplier = isBoss ? 1.5 : 1;
    const maxHp = Math.floor(monsterData.maxHp * hpMultiplier);

    return {
        id: `${monsterData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        templateId: monsterData.id,
        name: isBoss ? `${monsterData.name} (Boss)` : monsterData.name,
        isBoss,
        maxHp,
        currentHp: maxHp,
        ac: monsterData.armorClass,
        attacks: monsterData.attacks || [],
        abilities: monsterData.abilities || [],
        xpValue: Math.floor(monsterData.xpValue * (isBoss ? 2 : 1)),
        cr: monsterData.challengeRating,
        type: monsterData.type,
        lootTable: monsterData.lootTable || 'common'
    };
}

/**
 * Generate treasure for a treasure room
 */
function generateTreasure(difficulty) {
    const goldBase = 10 * difficulty;
    const goldVariance = Math.floor(Math.random() * goldBase);

    return {
        gold: goldBase + goldVariance,
        items: [] // Will be populated by loot.js
    };
}

/**
 * Generate trap for a trap room
 */
function generateTrap(difficulty) {
    const traps = [
        { name: 'Poison Dart Trap', damage: '1d6', type: 'piercing', dc: 10 + difficulty },
        { name: 'Pit Trap', damage: '1d10', type: 'bludgeoning', dc: 12 + difficulty },
        { name: 'Fire Glyph', damage: '2d6', type: 'fire', dc: 11 + difficulty },
        { name: 'Lightning Rune', damage: '2d8', type: 'lightning', dc: 13 + difficulty },
        { name: 'Poison Gas', damage: '1d8', type: 'poison', dc: 10 + difficulty }
    ];

    const trap = traps[Math.floor(Math.random() * Math.min(traps.length, difficulty + 2))];
    return {
        ...trap,
        triggered: false
    };
}

/**
 * Generate room name based on type
 */
function generateRoomName(type) {
    const names = {
        combat: ['Guard Room', 'Creature Den', 'Patrol Chamber', 'Hunting Grounds', 'Ambush Point'],
        treasure: ['Treasury', 'Hoard Room', 'Vault', 'Hidden Cache', 'Glittering Chamber'],
        trap: ['Trapped Corridor', 'Danger Zone', 'Rigged Room', 'Deadly Passage'],
        rest: ['Safe Haven', 'Quiet Alcove', 'Hidden Sanctuary', 'Rest Area'],
        empty: ['Empty Chamber', 'Dusty Room', 'Abandoned Hall', 'Silent Passage'],
        boss: ['Boss Chamber', 'Throne Room', 'Lair', 'Final Challenge']
    };

    const options = names[type] || names.empty;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate room description based on type
 */
function generateRoomDescription(type) {
    const descriptions = {
        combat: [
            'Hostile creatures lurk in the shadows.',
            'You hear growling from the darkness ahead.',
            'The room is occupied by enemies.',
            'Movement in the corners catches your eye.'
        ],
        treasure: [
            'Glittering objects catch your eye.',
            'A chest sits in the center of the room.',
            'Valuables are scattered about.',
            'Something shiny reflects the torchlight.'
        ],
        trap: [
            'Something feels wrong about this room.',
            'The floor tiles look suspicious.',
            'An eerie silence fills the air.',
            'Your instincts tell you to be careful.'
        ],
        rest: [
            'A peaceful area where you can catch your breath.',
            'The air here feels calmer.',
            'A safe spot to recover.',
            'No immediate threats are present.'
        ],
        empty: [
            'The room appears empty.',
            'Dust covers everything here.',
            'Nothing of interest remains.',
            'An unremarkable chamber.'
        ],
        boss: [
            'A massive chamber awaits. Something powerful lurks within...',
            'The final challenge lies ahead.',
            'You sense a powerful presence.',
            'This is it - the heart of the dungeon.'
        ]
    };

    const options = descriptions[type] || descriptions.empty;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get the current room
 */
function getCurrentRoom(dungeon) {
    return dungeon.rooms[dungeon.currentRoom] || null;
}

/**
 * Advance to next room
 */
function advanceRoom(dungeon) {
    if (dungeon.currentRoom < dungeon.totalRooms - 1) {
        dungeon.currentRoom++;
        return true;
    }
    dungeon.completed = true;
    return false;
}

/**
 * Mark current room as cleared
 */
function clearRoom(dungeon) {
    const room = getCurrentRoom(dungeon);
    if (room) {
        room.cleared = true;
    }
}

module.exports = {
    generateDungeon,
    generateEncounter,
    generateTreasure,
    generateTrap,
    getCurrentRoom,
    advanceRoom,
    clearRoom,
    calculateDifficulty,
    createMonsterInstance
};
