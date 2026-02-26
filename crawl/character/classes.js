const abilities = require('../../data/abilities.json');

const classes = {
    fighter: {
        id: 'fighter',
        name: 'Fighter',
        description: 'Master of martial combat with heavy armor and weapons.',
        hitDie: 10,
        primaryStat: 'strength',
        armorBonus: 4,
        baseAttack: {
            name: 'Sword Strike',
            damage: '1d8',
            damageType: 'slashing',
            toHitStat: 'strength'
        },
        startingAbilities: ['power_strike', 'second_wind'],
        levelAbilities: {
            3: 'cleave',
            5: 'action_surge',
            7: 'riposte',
            10: 'champion_strike'
        },
        proficiencies: ['all armor', 'shields', 'simple weapons', 'martial weapons'],
        savingThrows: ['strength', 'constitution']
    },
    rogue: {
        id: 'rogue',
        name: 'Rogue',
        description: 'Stealthy striker who exploits enemy weaknesses.',
        hitDie: 8,
        primaryStat: 'dexterity',
        armorBonus: 2,
        baseAttack: {
            name: 'Dagger Strike',
            damage: '1d6',
            damageType: 'piercing',
            toHitStat: 'dexterity'
        },
        startingAbilities: ['sneak_attack', 'evasion'],
        levelAbilities: {
            3: 'cunning_action',
            5: 'uncanny_dodge',
            7: 'assassinate',
            10: 'death_strike'
        },
        proficiencies: ['light armor', 'simple weapons', 'hand crossbow', 'rapier', 'shortsword'],
        savingThrows: ['dexterity', 'intelligence']
    },
    cleric: {
        id: 'cleric',
        name: 'Cleric',
        description: 'Divine healer who can also smite enemies.',
        hitDie: 8,
        primaryStat: 'wisdom',
        armorBonus: 3,
        baseAttack: {
            name: 'Mace Strike',
            damage: '1d6',
            damageType: 'bludgeoning',
            toHitStat: 'strength'
        },
        startingAbilities: ['heal', 'sacred_flame'],
        levelAbilities: {
            3: 'turn_undead',
            5: 'mass_heal',
            7: 'divine_strike',
            10: 'resurrection'
        },
        proficiencies: ['light armor', 'medium armor', 'shields', 'simple weapons'],
        savingThrows: ['wisdom', 'charisma']
    },
    wizard: {
        id: 'wizard',
        name: 'Wizard',
        description: 'Powerful spellcaster with devastating arcane magic.',
        hitDie: 6,
        primaryStat: 'intelligence',
        armorBonus: 0,
        baseAttack: {
            name: 'Staff Strike',
            damage: '1d4',
            damageType: 'bludgeoning',
            toHitStat: 'intelligence'
        },
        startingAbilities: ['magic_missile', 'shield'],
        levelAbilities: {
            3: 'fireball',
            5: 'lightning_bolt',
            7: 'cone_of_cold',
            10: 'meteor_swarm'
        },
        proficiencies: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
        savingThrows: ['intelligence', 'wisdom']
    },
    ranger: {
        id: 'ranger',
        name: 'Ranger',
        description: 'Skilled hunter with nature magic and ranged attacks.',
        hitDie: 10,
        primaryStat: 'dexterity',
        armorBonus: 2,
        baseAttack: {
            name: 'Bow Shot',
            damage: '1d8',
            damageType: 'piercing',
            toHitStat: 'dexterity'
        },
        startingAbilities: ['hunters_mark', 'cure_wounds'],
        levelAbilities: {
            3: 'multiattack',
            5: 'spike_growth',
            7: 'volley',
            10: 'swift_quiver'
        },
        proficiencies: ['light armor', 'medium armor', 'shields', 'simple weapons', 'martial weapons'],
        savingThrows: ['strength', 'dexterity']
    },
    barbarian: {
        id: 'barbarian',
        name: 'Barbarian',
        description: 'Rage-fueled warrior with incredible toughness.',
        hitDie: 12,
        primaryStat: 'strength',
        armorBonus: 1,
        baseAttack: {
            name: 'Greataxe Swing',
            damage: '1d12',
            damageType: 'slashing',
            toHitStat: 'strength'
        },
        startingAbilities: ['rage', 'reckless_attack'],
        levelAbilities: {
            3: 'frenzy',
            5: 'extra_attack',
            7: 'brutal_critical',
            10: 'relentless_rage'
        },
        proficiencies: ['light armor', 'medium armor', 'shields', 'simple weapons', 'martial weapons'],
        savingThrows: ['strength', 'constitution']
    }
};

/**
 * Get all available classes
 * @returns {object[]}
 */
function getAllClasses() {
    return Object.values(classes);
}

/**
 * Get a class by ID
 * @param {string} classId
 * @returns {object|null}
 */
function getClass(classId) {
    return classes[classId] || null;
}

/**
 * Get starting abilities for a class
 * @param {string} classId
 * @returns {object[]}
 */
function getStartingAbilities(classId) {
    const cls = getClass(classId);
    if (!cls) return [];

    const classAbilities = abilities[classId] || {};
    return cls.startingAbilities.map(abilityId => classAbilities[abilityId]).filter(Boolean);
}

/**
 * Get all abilities unlocked at or before a certain level
 * @param {string} classId
 * @param {number} level
 * @returns {object[]}
 */
function getAbilitiesForLevel(classId, level) {
    const cls = getClass(classId);
    if (!cls) return [];

    const classAbilities = abilities[classId] || {};
    const unlockedAbilities = [...cls.startingAbilities];

    for (const [unlockLevel, abilityId] of Object.entries(cls.levelAbilities)) {
        if (parseInt(unlockLevel) <= level) {
            unlockedAbilities.push(abilityId);
        }
    }

    return unlockedAbilities.map(id => classAbilities[id]).filter(Boolean);
}

/**
 * Get the ability unlocked at a specific level
 * @param {string} classId
 * @param {number} level
 * @returns {object|null}
 */
function getNewAbilityAtLevel(classId, level) {
    const cls = getClass(classId);
    if (!cls) return null;

    const abilityId = cls.levelAbilities[level];
    if (!abilityId) return null;

    const classAbilities = abilities[classId] || {};
    return classAbilities[abilityId] || null;
}

/**
 * Calculate starting HP for a class
 * @param {string} classId
 * @param {number} constitutionMod
 * @returns {number}
 */
function getStartingHp(classId, constitutionMod) {
    const cls = getClass(classId);
    if (!cls) return 10;

    // Max hit die at level 1 + CON mod
    return cls.hitDie + constitutionMod;
}

/**
 * Calculate HP gained on level up
 * @param {string} classId
 * @param {number} constitutionMod
 * @returns {number}
 */
function rollHpIncrease(classId, constitutionMod) {
    const cls = getClass(classId);
    if (!cls) return 5;

    // Roll hit die (or take average) + CON mod
    const roll = Math.floor(Math.random() * cls.hitDie) + 1;
    return Math.max(1, roll + constitutionMod);
}

/**
 * Get base armor class from class
 * @param {string} classId
 * @returns {number}
 */
function getBaseArmorBonus(classId) {
    const cls = getClass(classId);
    return cls ? cls.armorBonus : 0;
}

/**
 * Get the base attack for a class
 * @param {string} classId
 * @returns {object}
 */
function getBaseAttack(classId) {
    const cls = getClass(classId);
    return cls ? cls.baseAttack : { name: 'Unarmed Strike', damage: '1d4', damageType: 'bludgeoning', toHitStat: 'strength' };
}

module.exports = {
    classes,
    getAllClasses,
    getClass,
    getStartingAbilities,
    getAbilitiesForLevel,
    getNewAbilityAtLevel,
    getStartingHp,
    rollHpIncrease,
    getBaseArmorBonus,
    getBaseAttack
};
