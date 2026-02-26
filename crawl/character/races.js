const races = {
    human: {
        id: 'human',
        name: 'Human',
        description: 'Versatile and ambitious, humans excel in any role.',
        statBonuses: {
            strength: 1,
            dexterity: 1,
            constitution: 1,
            intelligence: 1,
            wisdom: 1,
            charisma: 1
        },
        traits: [
            { name: 'Versatile', description: '+1 to all stats' },
            { name: 'Determined', description: '+5% XP gain', effect: { xpBonus: 0.05 } }
        ],
        speed: 30,
        size: 'medium'
    },
    elf: {
        id: 'elf',
        name: 'Elf',
        description: 'Graceful and long-lived, elves have keen senses.',
        statBonuses: {
            dexterity: 2,
            intelligence: 1
        },
        traits: [
            { name: 'Keen Senses', description: '+2 to initiative', effect: { initiativeBonus: 2 } },
            { name: 'Trance', description: 'Rest rooms restore 25% more HP', effect: { restBonus: 0.25 } }
        ],
        speed: 30,
        size: 'medium'
    },
    dwarf: {
        id: 'dwarf',
        name: 'Dwarf',
        description: 'Stout and hardy, dwarves are resilient warriors.',
        statBonuses: {
            constitution: 2,
            strength: 1
        },
        traits: [
            { name: 'Dwarven Resilience', description: '+2 HP per level', effect: { hpPerLevel: 2 } },
            { name: 'Stonecunning', description: '+2 AC vs traps', effect: { trapAcBonus: 2 } }
        ],
        speed: 25,
        size: 'medium'
    },
    halfling: {
        id: 'halfling',
        name: 'Halfling',
        description: 'Small but brave, halflings are surprisingly lucky.',
        statBonuses: {
            dexterity: 2,
            charisma: 1
        },
        traits: [
            { name: 'Lucky', description: 'Reroll natural 1s on attacks', effect: { rerollOnes: true } },
            { name: 'Brave', description: 'Immune to fear effects', effect: { fearImmune: true } }
        ],
        speed: 25,
        size: 'small'
    },
    halforc: {
        id: 'halforc',
        name: 'Half-Orc',
        description: 'Powerful and fierce, half-orcs are fearsome in battle.',
        statBonuses: {
            strength: 2,
            constitution: 1
        },
        traits: [
            { name: 'Relentless Endurance', description: 'Once per dungeon, survive lethal blow with 1 HP', effect: { relentless: true } },
            { name: 'Savage Attacks', description: '+1 damage die on crits', effect: { savageCrits: true } }
        ],
        speed: 30,
        size: 'medium'
    },
    gnome: {
        id: 'gnome',
        name: 'Gnome',
        description: 'Clever and curious, gnomes have innate magical talent.',
        statBonuses: {
            intelligence: 2,
            dexterity: 1
        },
        traits: [
            { name: 'Arcane Knowledge', description: '+1 to ability damage', effect: { abilityDamageBonus: 1 } },
            { name: 'Cunning', description: '+2 to trap avoidance', effect: { trapSaveBonus: 2 } }
        ],
        speed: 25,
        size: 'small'
    }
};

/**
 * Get all available races
 * @returns {object[]}
 */
function getAllRaces() {
    return Object.values(races);
}

/**
 * Get a race by ID
 * @param {string} raceId
 * @returns {object|null}
 */
function getRace(raceId) {
    return races[raceId] || null;
}

/**
 * Apply racial stat bonuses to base stats
 * @param {object} baseStats
 * @param {string} raceId
 * @returns {object}
 */
function applyRacialBonuses(baseStats, raceId) {
    const race = getRace(raceId);
    if (!race) return baseStats;

    const modifiedStats = { ...baseStats };
    for (const [stat, bonus] of Object.entries(race.statBonuses)) {
        modifiedStats[stat] = (modifiedStats[stat] || 10) + bonus;
    }
    return modifiedStats;
}

/**
 * Get all racial trait effects for a race
 * @param {string} raceId
 * @returns {object}
 */
function getRacialEffects(raceId) {
    const race = getRace(raceId);
    if (!race) return {};

    const effects = {};
    for (const trait of race.traits) {
        if (trait.effect) {
            Object.assign(effects, trait.effect);
        }
    }
    return effects;
}

module.exports = {
    races,
    getAllRaces,
    getRace,
    applyRacialBonuses,
    getRacialEffects
};
