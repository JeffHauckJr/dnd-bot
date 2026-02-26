const { buildTurnOrder, getCurrentTurn, advanceTurn, markDead, markAlive, checkCombatEnd } = require('./initiative');
const { generateMonsterLoot, consolidateLoot } = require('../dungeon/loot');
const { getModifier, rollDiceTotal } = require('../../utils/dice');
const { getClass } = require('../character/classes');
const { createGrid, removeFromGrid } = require('./grid');
const { assignStartingPositions, resetMovement, monsterMovement, selectAttackInRange } = require('./movement');

/**
 * Create a new combat instance
 * @param {object[]} players - Player characters in combat
 * @param {object[]} monsters - Monster instances
 * @param {object} room - The room where combat occurs
 * @returns {object} Combat state
 */
function createCombat(players, monsters, room) {
    const turnOrder = buildTurnOrder(players, monsters);
    const grid = createGrid();

    const combat = {
        id: `combat_${Date.now()}`,
        room,
        round: 1,
        turnOrder,
        currentTurnIndex: 0,
        grid,
        players: players.map(p => ({
            ...p,
            combatHp: p.currentHp,
            defending: false,
            buffs: [],
            debuffs: [],
            conditions: [],
            cooldowns: {},
            position: null,
            movementRemaining: 6
        })),
        monsters: monsters.map(m => ({
            ...m,
            defending: false,
            buffs: [],
            debuffs: [],
            conditions: [],
            cooldowns: {},
            position: null,
            movementRemaining: 6,
            lastDamageType: null
        })),
        log: [],
        loot: [],
        status: 'active', // active, victory, defeat
        lastAction: null
    };

    // Assign strategic starting positions
    assignStartingPositions(combat);

    return combat;
}

/**
 * Get the current combatant whose turn it is
 */
function getCurrentCombatant(combat) {
    const turn = getCurrentTurn(combat.turnOrder, combat.currentTurnIndex);
    if (!turn) return null;

    if (turn.isPlayer) {
        return combat.players.find(p => p.odiscordUserId === turn.odiscordUserId);
    } else {
        return combat.monsters.find(m => m.id === turn.id);
    }
}

/**
 * Check if it's a specific player's turn
 */
function isPlayerTurn(combat, odiscordUserId) {
    const turn = getCurrentTurn(combat.turnOrder, combat.currentTurnIndex);
    return turn && turn.isPlayer && turn.odiscordUserId === odiscordUserId;
}

// ─── Buff / stat helper functions (shared across processAttack & processUseAbility) ───

/** Check if combatant has a named buff active */
function hasBuff(combatant, buffName) {
    return combatant.buffs?.some(b => b.name === buffName);
}

/** Sum all AC bonuses granted by active buffs (Shield, Cunning Action, etc.) */
function getBuffAC(combatant) {
    let bonus = 0;
    for (const b of (combatant.buffs || [])) {
        if (b.effect && typeof b.effect === 'object' && b.effect.ac) {
            bonus += b.effect.ac;
        }
    }
    return bonus;
}

/** Get bonus damage from buffs (flat number + optional dice string) */
function getBuffBonusDamage(combatant) {
    let flat = 0;
    let dice = null;
    for (const b of (combatant.buffs || [])) {
        if (b.effect && typeof b.effect === 'object') {
            if (typeof b.effect.bonusDamage === 'number') flat += b.effect.bonusDamage;
            if (typeof b.effect.bonusDamage === 'string') dice = b.effect.bonusDamage;
        }
    }
    return { flat, dice };
}

/** Get damage resistance multiplier from buffs (e.g. Rage 0.5 = take half) */
function getDamageResistance(combatant, damageType = null) {
    // Check buff resistance (Rage gives 0.5 resistance to all physical)
    for (const b of (combatant.buffs || [])) {
        if (b.effect && typeof b.effect === 'object' && b.effect.damageResistance) {
            return b.effect.damageResistance;
        }
    }
    // Check armor resistance (Dragon Scale resists fire)
    if (damageType && combatant.equipment?.armor?.resistances) {
        if (combatant.equipment.armor.resistances.includes(damageType)) {
            return 0.5; // 50% damage reduction
        }
    }
    return 0;
}

/** Roll 2d20 take highest */
function rollWithAdvantage() {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    return { roll: Math.max(r1, r2), r1, r2 };
}

/** Check if a combatant has Relentless Rage passive and hasn't used it yet.
 *  Requires: player has the ability unlocked + Rage buff is active */
function checkRelentlessRage(combatant) {
    if (combatant._usedRelentlessRage) return false;
    // Must be a player with the relentless_rage ability unlocked
    if (!combatant.abilities || !combatant.abilities.includes('relentless_rage')) return false;
    // Must currently be raging
    return hasBuff(combatant, 'Rage');
}

/** Check and consume a one-time reaction buff (e.g., Uncanny Dodge halve_damage) */
function checkAndConsumeReaction(combatant, effectName) {
    if (!combatant.buffs) return false;
    const idx = combatant.buffs.findIndex(b => b.effect === effectName);
    if (idx === -1) return false;
    combatant.buffs.splice(idx, 1); // consume the reaction
    return true;
}

// ─── Monster ability helpers ───

/** Get all monster abilities of a given type */
function getMonsterAbilities(monster, type) {
    return (monster.abilities || []).filter(a => a.type === type);
}

/** Check if a monster has damage resistance for a given damage type */
function getMonsterResistance(monster, damageType) {
    const resistances = getMonsterAbilities(monster, 'resistance');
    for (const r of resistances) {
        if (r.damageTypes?.includes(damageType)) return r.reduction || 0.5;
    }
    return 0;
}

/** Check if a monster is immune to a damage type */
function hasMonsterImmunity(monster, damageType) {
    const immunities = getMonsterAbilities(monster, 'immunity');
    return immunities.some(i => i.damageTypes?.includes(damageType));
}

/** Get on-hit abilities for a monster, optionally filtered by attack name */
function getOnHitAbilities(monster, attackName) {
    return getMonsterAbilities(monster, 'on_hit').filter(a =>
        !a.attackName || a.attackName === attackName
    );
}

/** Get ready special attacks (off cooldown) */
function getReadySpecialAttacks(monster) {
    return getMonsterAbilities(monster, 'special_attack').filter(a => {
        if (!a.cooldown) return true;
        return !monster.cooldowns?.[a.name] || monster.cooldowns[a.name] <= 0;
    });
}

/** Roll a saving throw for a combatant */
function rollSavingThrow(combatant, stat, dc) {
    const statValue = combatant.stats?.[stat] || 10;
    const mod = getModifier(statValue);
    const roll = Math.floor(Math.random() * 20) + 1;
    return { roll, mod, total: roll + mod, success: (roll + mod) >= dc, nat1: roll === 1, nat20: roll === 20 };
}

/** Apply a condition (stunned, weakened) to a combatant */
function applyCondition(combatant, conditionName, duration) {
    if (!combatant.conditions) combatant.conditions = [];
    // Don't stack same condition, just refresh duration
    const existing = combatant.conditions.find(c => c.name === conditionName);
    if (existing) {
        existing.duration = Math.max(existing.duration, duration);
    } else {
        combatant.conditions.push({ name: conditionName, duration });
    }
}

/** Check if combatant has a specific condition */
function hasCondition(combatant, conditionName) {
    return combatant.conditions?.some(c => c.name === conditionName);
}

/** Get attack penalty from conditions (weakened = -2) */
function getConditionAttackPenalty(combatant) {
    let penalty = 0;
    for (const c of (combatant.conditions || [])) {
        if (c.name === 'weakened') penalty += 2;
    }
    return penalty;
}

/** Get racial combat effects for a player combatant */
function getRacialCombatEffects(combatant) {
    if (!combatant.race) return {};
    const { getRacialEffects } = require('../character/races');
    return getRacialEffects(combatant.race);
}

/** Apply damage to a target, handling death, Relentless Rage, Half-Orc Relentless Endurance, and grid removal */
function applyDamage(combat, damage, target) {
    if (target.combatHp !== undefined) {
        target.combatHp -= damage;
    } else {
        target.currentHp -= damage;
    }
    const hp = target.combatHp !== undefined ? target.combatHp : target.currentHp;

    // Relentless Rage (Barbarian passive): survive at 1 HP once while raging
    if (hp <= 0 && checkRelentlessRage(target)) {
        if (target.combatHp !== undefined) {
            target.combatHp = 1;
        } else {
            target.currentHp = 1;
        }
        target._usedRelentlessRage = true;
        return { killed: false, relentlessRage: true, relentlessEndurance: false };
    }

    // Half-Orc Relentless Endurance (racial): survive at 1 HP once per dungeon
    if (hp <= 0 && !target._usedRelentlessEndurance) {
        const racialEffects = getRacialCombatEffects(target);
        if (racialEffects.relentless) {
            if (target.combatHp !== undefined) {
                target.combatHp = 1;
            } else {
                target.currentHp = 1;
            }
            target._usedRelentlessEndurance = true;
            return { killed: false, relentlessRage: false, relentlessEndurance: true };
        }
    }

    if (hp <= 0) {
        markDead(combat.turnOrder, target.id || target.odiscordUserId);
        if (combat.grid) removeFromGrid(combat.grid, target);
        return { killed: true, relentlessRage: false, relentlessEndurance: false };
    }
    return { killed: false, relentlessRage: false, relentlessEndurance: false };
}

/**
 * Process an attack action
 * @param {object} combat - Combat state
 * @param {object} attacker - The attacking combatant
 * @param {object} target - The target combatant
 * @param {object} weapon - Weapon or attack being used (optional)
 * @returns {object} Attack result
 */
function processAttack(combat, attacker, target, weapon = null) {
    const isPlayer = !!attacker.odiscordUserId;

    // Calculate attack roll
    let attackBonus = 0;
    let damageFormula = '1d4';
    let damageType = 'bludgeoning';

    let bonusDamageType = null; // For weapons with elemental damage (e.g., Flaming Sword)

    if (isPlayer) {
        const cls = getClass(attacker.class);
        const primaryStat = cls?.primaryStat || 'strength';
        attackBonus = getModifier(attacker.stats[primaryStat]);

        if (attacker.equipment?.weapon) {
            const wpn = attacker.equipment.weapon;
            damageFormula = wpn.damage;
            damageType = wpn.damageType;
            attackBonus += wpn.toHitBonus || 0;
            bonusDamageType = wpn.bonusDamageType || null;
        } else if (cls?.baseAttack) {
            damageFormula = cls.baseAttack.damage;
            damageType = cls.baseAttack.damageType;
        }
    } else {
        // Monster attack
        const attack = weapon || (attacker.attacks && attacker.attacks[0]);
        if (attack) {
            attackBonus = attack.toHit || 0;
            damageFormula = attack.damage || '1d6';
            damageType = attack.damageType || 'slashing';
        }
    }

    // Apply weakened condition penalty (-2 to attacks)
    attackBonus -= getConditionAttackPenalty(attacker);

    // Check if attacker has advantage (Reckless Attack buff) or target has Reckless debuff (gives attacker advantage)
    const hasAdvantage = !isPlayer && target.debuffs?.some(d => d.name === 'Reckless');
    const racialEffects = isPlayer ? getRacialCombatEffects(attacker) : {};
    let attackRoll;
    let rollNote = '';
    if (hasAdvantage) {
        const adv = rollWithAdvantage();
        attackRoll = adv.roll;
        rollNote = ` (Advantage: ${adv.r1}, ${adv.r2})`;
    } else {
        attackRoll = Math.floor(Math.random() * 20) + 1;
    }

    // Halfling Lucky: reroll natural 1s
    if (attackRoll === 1 && racialEffects.rerollOnes) {
        const reroll = Math.floor(Math.random() * 20) + 1;
        rollNote += ` (Lucky: rerolled 1 → ${reroll})`;
        attackRoll = reroll;
    }

    const isCrit = attackRoll === 20;
    const isMiss = attackRoll === 1;
    const totalAttack = attackRoll + attackBonus;

    // Calculate target AC (defend bonus + buff AC)
    let targetAC = target.ac || target.armorClass || 10;
    if (target.defending) {
        targetAC += 2;
    }
    targetAC += getBuffAC(target);

    const result = {
        attacker: attacker.name,
        target: target.name,
        attackRoll,
        attackBonus,
        totalAttack,
        targetAC,
        hit: false,
        crit: false,
        damage: 0,
        damageType,
        killed: false,
        message: ''
    };

    // Check hit
    if (isMiss) {
        result.message = `**${attacker.name}** rolled a natural 1! Critical miss!${rollNote}`;
        return result;
    }

    if (isCrit || totalAttack >= targetAC) {
        result.hit = true;
        result.crit = isCrit;

        // Roll damage
        let damage = rollDiceTotal(damageFormula);

        // Double dice on crit
        if (isCrit) {
            damage += rollDiceTotal(damageFormula);
            // Half-Orc Savage Attacks: +1 damage die on crits
            if (racialEffects.savageCrits) {
                damage += rollDiceTotal(damageFormula);
                rollNote += ' (Savage Attacks!)';
            }
            // Vorpal weapon: chance to instantly kill on crit (not bosses)
            if (isPlayer && attacker.equipment?.weapon?.properties?.includes('vorpal')) {
                const targetHp = target.combatHp !== undefined ? target.combatHp : target.currentHp;
                // 25% chance to decapitate, or if damage would exceed 75% of remaining HP
                if (Math.random() < 0.25 || damage >= targetHp * 0.75) {
                    if (!target.isBoss) {
                        damage = targetHp + 100; // Instant kill
                        rollNote += ' **VORPAL DECAPITATION!**';
                    } else {
                        damage += rollDiceTotal('6d8'); // Massive bonus vs bosses
                        rollNote += ' (Vorpal Strike!)';
                    }
                }
            }
        }

        // Add stat modifier to damage for players
        if (isPlayer) {
            const cls = getClass(attacker.class);
            const primaryStat = cls?.primaryStat || 'strength';
            damage += getModifier(attacker.stats[primaryStat]);

            // Add buff bonus damage (Rage, Hunter's Mark, etc.)
            const bonus = getBuffBonusDamage(attacker);
            damage += bonus.flat;
            if (bonus.dice) damage += rollDiceTotal(bonus.dice);
        }

        // Apply defend damage reduction
        if (target.defending) {
            damage = Math.floor(damage * 0.5);
        }

        // Apply damage resistance from buffs (e.g., Rage) and armor
        const resistance = getDamageResistance(target, damageType);
        if (resistance > 0) {
            damage = Math.floor(damage * (1 - resistance));
        }

        // Uncanny Dodge reaction: halve damage (consumed on use)
        if (checkAndConsumeReaction(target, 'halve_damage')) {
            damage = Math.floor(damage * 0.5);
            rollNote += ' (Uncanny Dodge!)';
        }

        // Monster immunity check (e.g., fire immunity)
        if (!target.odiscordUserId && hasMonsterImmunity(target, damageType)) {
            result.message = `**${attacker.name}** hits **${target.name}** but it is **immune to ${damageType}**!`;
            result.damage = 0;
            return result;
        }

        // Monster resistance check (e.g., Skeleton half from slashing/piercing)
        if (!target.odiscordUserId) {
            const monsterRes = getMonsterResistance(target, damageType);
            if (monsterRes > 0) {
                damage = Math.floor(damage * (1 - monsterRes));
                rollNote += ` (Resistant!)`;
            }
        }

        // Minimum 1 damage
        damage = Math.max(1, damage);
        result.damage = damage;

        // Track what damage type hit this monster (for regeneration prevention)
        // bonusDamageType (e.g., fire from Flaming Sword) takes priority for regen prevention
        if (!target.odiscordUserId) {
            target.lastDamageType = bonusDamageType || damageType;
        }

        // Apply damage (handles Relentless Rage and grid removal)
        const dmgResult = applyDamage(combat, damage, target);
        result.killed = dmgResult.killed;

        // Format damage type display (include bonus damage type if present)
        const damageTypeDisplay = bonusDamageType ? `${damageType}/${bonusDamageType}` : damageType;

        if (isCrit) {
            result.message = `**${attacker.name}** rolls **20** (CRIT!) and hits **${target.name}** for **${damage}** ${damageTypeDisplay} damage!${rollNote}`;
        } else {
            result.message = `**${attacker.name}** rolls **${attackRoll}+${attackBonus}=${totalAttack}** vs AC ${targetAC} and hits **${target.name}** for **${damage}** ${damageTypeDisplay} damage!${rollNote}`;
        }

        if (dmgResult.relentlessRage) {
            result.message += ` **${target.name}** refuses to fall! (Relentless Rage - survives at 1 HP)`;
        }
        if (dmgResult.relentlessEndurance) {
            result.message += ` **${target.name}** refuses to fall! (Relentless Endurance - survives at 1 HP)`;
        }
        if (result.killed) {
            result.message += ` **${target.name}** is defeated!`;
        }

        // Monster on-hit effects (poison, paralysis, energy drain, etc.)
        if (!isPlayer && !result.killed) {
            const attackName = weapon?.name || (attacker.attacks?.[0]?.name);
            const onHitAbilities = getOnHitAbilities(attacker, attackName);
            for (const ability of onHitAbilities) {
                // Bonus damage (poison, acid, necrotic, etc.)
                if (ability.bonusDamage) {
                    const bonusDmg = rollDiceTotal(ability.bonusDamage);
                    // Check target immunity
                    if (ability.damageType && hasMonsterImmunity(target, ability.damageType)) {
                        // Target immune to bonus damage type - skip
                    } else {
                        applyDamage(combat, bonusDmg, target);
                        result.message += ` (+${bonusDmg} ${ability.damageType || ''})`;
                        // Self-heal from damage (e.g., Vampire Blood Drain)
                        if (ability.selfHeal) {
                            const currentHp = attacker.combatHp !== undefined ? attacker.combatHp : attacker.currentHp;
                            const maxHp = attacker.maxHp;
                            const healed = Math.min(bonusDmg, maxHp - currentHp);
                            if (healed > 0) {
                                if (attacker.combatHp !== undefined) attacker.combatHp += healed;
                                else attacker.currentHp += healed;
                                result.message += ` (heals ${healed})`;
                            }
                        }
                    }
                }
                // Condition effects (stun, weaken)
                if (ability.effect && ability.saveDC) {
                    const save = rollSavingThrow(target, ability.saveStat || 'constitution', ability.saveDC);
                    if (!save.success) {
                        applyCondition(target, ability.effect, ability.duration || 1);
                        const conditionLabel = ability.effect === 'stunned' ? 'stunned' : 'weakened';
                        result.message += ` **${target.name}** is **${conditionLabel}**! (failed DC ${ability.saveDC} ${ability.saveStat || 'CON'} save: ${save.total})`;
                    } else {
                        result.message += ` (${target.name} resists ${ability.name}: ${save.total} vs DC ${ability.saveDC})`;
                    }
                }
            }
        }
    } else {
        result.message = `**${attacker.name}** rolls **${attackRoll}+${attackBonus}=${totalAttack}** vs AC ${targetAC} and misses **${target.name}**!${rollNote}`;

        // Riposte: if monster misses a player with Riposte buff, counter-attack
        if (!isPlayer && target.odiscordUserId && checkAndConsumeReaction(target, 'riposte_counter')) {
            const riposteDmg = rollDiceTotal(target.equipment?.weapon?.damage || '1d6');
            const riposteResult = applyDamage(combat, riposteDmg, attacker);
            result.message += ` **${target.name}** ripostes for **${riposteDmg}** damage!`;
            if (riposteResult.killed) {
                result.message += ` **${attacker.name}** is defeated!`;
            }
        }
    }

    return result;
}

/**
 * Process a defend action
 */
function processDefend(combat, defender) {
    defender.defending = true;

    return {
        defender: defender.name,
        message: `**${defender.name}** takes a defensive stance! (+2 AC, 50% damage reduction until next turn)`
    };
}

/**
 * Process using an item
 */
function processUseItem(combat, user, item, target = null) {
    const actualTarget = target || user;
    const result = {
        user: user.name,
        item: item.name,
        target: actualTarget.name,
        message: '',
        effect: null
    };

    if (!item.effect) {
        result.message = `**${user.name}** tries to use **${item.name}** but nothing happens.`;
        return result;
    }

    switch (item.effect.type) {
        case 'heal': {
            const healAmount = rollDiceTotal(item.effect.amount);
            const maxHp = actualTarget.maxHp;
            const currentHp = actualTarget.combatHp !== undefined ? actualTarget.combatHp : actualTarget.currentHp;
            const wasDowned = currentHp <= 0;
            const newHp = Math.min(maxHp, currentHp + healAmount);
            const actualHeal = newHp - currentHp;

            if (actualTarget.combatHp !== undefined) {
                actualTarget.combatHp = newHp;
            } else {
                actualTarget.currentHp = newHp;
            }

            // Revive downed player
            if (wasDowned && newHp > 0) {
                markAlive(combat.turnOrder, actualTarget.id || actualTarget.odiscordUserId);
            }

            result.effect = { type: 'heal', amount: actualHeal };
            result.message = `**${user.name}** uses **${item.name}** on **${actualTarget.name}**, restoring **${actualHeal}** HP!`;
            if (wasDowned && newHp > 0) {
                result.message += ` **${actualTarget.name}** is back on their feet!`;
            }
            break;
        }
        case 'damage': {
            const damageAmount = rollDiceTotal(item.effect.amount);
            const targets = item.effect.aoe ? combat.monsters : [actualTarget];
            const defeated = [];

            for (const t of targets) {
                const dmgRes = applyDamage(combat, damageAmount, t);
                if (dmgRes.killed) defeated.push(t.name);
            }

            result.effect = { type: 'damage', amount: damageAmount };
            if (item.effect.aoe) {
                result.message = `**${user.name}** uses **${item.name}**, dealing **${damageAmount}** ${item.effect.damageType || ''} damage to all enemies!`;
            } else {
                result.message = `**${user.name}** uses **${item.name}** on **${actualTarget.name}**, dealing **${damageAmount}** damage!`;
            }
            if (defeated.length > 0) {
                result.message += ` Defeated: ${defeated.join(', ')}!`;
            }
            break;
        }
        case 'cure': {
            // Remove a condition from the target
            const conditionToCure = item.effect.condition;
            if (actualTarget.conditions) {
                const beforeCount = actualTarget.conditions.length;
                actualTarget.conditions = actualTarget.conditions.filter(c => c.name !== conditionToCure);
                const cured = actualTarget.conditions.length < beforeCount;
                if (cured) {
                    result.message = `**${user.name}** uses **${item.name}** on **${actualTarget.name}**, curing **${conditionToCure}**!`;
                } else {
                    result.message = `**${user.name}** uses **${item.name}** on **${actualTarget.name}**, but they weren't ${conditionToCure}.`;
                }
            } else {
                result.message = `**${user.name}** uses **${item.name}** on **${actualTarget.name}**.`;
            }
            result.effect = { type: 'cure', condition: conditionToCure };
            break;
        }
        default:
            result.message = `**${user.name}** uses **${item.name}**.`;
    }

    // Remove item from inventory (or reduce quantity)
    const invItem = user.inventory?.find(i => i.id === item.id);
    if (invItem) {
        if (invItem.quantity > 1) {
            invItem.quantity--;
        } else {
            user.inventory = user.inventory.filter(i => i.id !== item.id);
        }
    }

    return result;
}

/**
 * Process using an ability
 */
function processUseAbility(combat, user, ability, target = null) {
    const abilities = require('../../data/abilities.json');
    const abilityData = abilities[user.class]?.[ability] || null;

    if (!abilityData) {
        return {
            user: user.name,
            ability: ability,
            message: `**${user.name}** tries to use an unknown ability.`,
            success: false
        };
    }

    // Check cooldown
    if (user.cooldowns && user.cooldowns[ability] > 0) {
        return {
            user: user.name,
            ability: abilityData.name,
            message: `**${abilityData.name}** is on cooldown for ${user.cooldowns[ability]} more turns!`,
            success: false
        };
    }

    const result = {
        user: user.name,
        ability: abilityData.name,
        target: target?.name || null,
        message: '',
        success: true,
        effect: null
    };

    // Set cooldown
    if (!user.cooldowns) user.cooldowns = {};
    user.cooldowns[ability] = abilityData.cooldown || 0;

    // Helper: resolve "weapon" damage to actual weapon dice
    function resolveAbilityDamage(abilityData, user) {
        let formula = abilityData.damage;
        if (formula === 'weapon') {
            if (user.equipment?.weapon) {
                formula = user.equipment.weapon.damage;
            } else {
                const cls = getClass(user.class);
                formula = cls?.baseAttack?.damage || '1d4';
            }
        }
        return formula;
    }

    // Helper: get player's attack bonus
    function getAttackBonus(user) {
        const cls = getClass(user.class);
        const primaryStat = cls?.primaryStat || 'strength';
        return getModifier(user.stats[primaryStat]);
    }

    // Get racial effects once for the user
    const userRacialEffects = getRacialCombatEffects(user);

    switch (abilityData.type) {
        case 'attack': {
            const damageFormula = resolveAbilityDamage(abilityData, user);
            let damage = rollDiceTotal(damageFormula);
            const actualTarget = target || combat.monsters.find(m => (m.combatHp || m.currentHp) > 0);

            if (!actualTarget) break;

            const isAutoHit = abilityData.autoHit;
            const critRange = abilityData.critRange || 20;
            const hasAdvantage = abilityData.effect?.advantage || hasBuff(user, 'Reckless Attack');

            // Gnome Arcane Knowledge: +1 ability damage
            if (userRacialEffects.abilityDamageBonus) {
                damage += userRacialEffects.abilityDamageBonus;
            }

            if (isAutoHit) {
                // Auto-hit abilities (e.g., Magic Missile) - no attack roll needed
                // Add stat modifier
                damage += getAttackBonus(user);
                // Add buff bonus damage
                const bonus = getBuffBonusDamage(user);
                damage += bonus.flat;
                if (bonus.dice) damage += rollDiceTotal(bonus.dice);

                result.message = `**${user.name}** uses **${abilityData.name}** on **${actualTarget.name}** for **${damage}** ${abilityData.damageType || ''} damage! (auto-hit)`;
            } else {
                // Roll to hit
                let attackRoll;
                let rollNote = '';
                if (hasAdvantage) {
                    const adv = rollWithAdvantage();
                    attackRoll = adv.roll;
                    rollNote = ` (Advantage: ${adv.r1}, ${adv.r2})`;
                } else {
                    attackRoll = Math.floor(Math.random() * 20) + 1;
                }

                // Halfling Lucky: reroll natural 1s
                if (attackRoll === 1 && userRacialEffects.rerollOnes) {
                    const reroll = Math.floor(Math.random() * 20) + 1;
                    rollNote += ` (Lucky: rerolled 1 → ${reroll})`;
                    attackRoll = reroll;
                }

                const isCrit = attackRoll >= critRange;
                const isMiss = attackRoll === 1;
                const attackBonus = getAttackBonus(user);
                const totalAttack = attackRoll + attackBonus;

                // Calculate target AC
                let targetAC = actualTarget.ac || actualTarget.armorClass || 10;
                if (actualTarget.defending) targetAC += 2;
                targetAC += getBuffAC(actualTarget);

                if (isMiss) {
                    result.message = `**${user.name}** uses **${abilityData.name}** and rolls a natural 1! Critical miss!${rollNote}`;
                    break;
                }

                if (!isCrit && totalAttack < targetAC) {
                    result.message = `**${user.name}** uses **${abilityData.name}** and rolls **${attackRoll}+${attackBonus}=${totalAttack}** vs AC ${targetAC} - miss!${rollNote}`;
                    break;
                }

                // Hit! Calculate damage
                if (isCrit) {
                    damage += rollDiceTotal(damageFormula); // double dice on crit
                    // Half-Orc Savage Attacks: +1 damage die on crits
                    if (userRacialEffects.savageCrits) {
                        damage += rollDiceTotal(damageFormula);
                        rollNote += ' (Savage Attacks!)';
                    }
                }

                // Add stat modifier
                damage += attackBonus;

                // Multiplier (e.g., Assassinate 3x on full HP)
                if (abilityData.multiplier) {
                    const targetHp = actualTarget.combatHp !== undefined ? actualTarget.combatHp : actualTarget.currentHp;
                    if (abilityData.condition === 'target_full_hp' && targetHp >= actualTarget.maxHp) {
                        damage *= abilityData.multiplier;
                        rollNote += ` (${abilityData.multiplier}x bonus!)`;
                    }
                }

                // Buff bonus damage (Rage, Hunter's Mark)
                const bonus = getBuffBonusDamage(user);
                damage += bonus.flat;
                if (bonus.dice) damage += rollDiceTotal(bonus.dice);

                // Apply defend/resistance on target
                if (actualTarget.defending) {
                    damage = Math.floor(damage * 0.5);
                }
                const resistance = getDamageResistance(actualTarget, abilityData.damageType);
                if (resistance > 0) {
                    damage = Math.floor(damage * (1 - resistance));
                }

                damage = Math.max(1, damage);

                // Execute effect (Death Strike kills below 25%)
                if (abilityData.effect === 'execute_below_25') {
                    const targetHp = actualTarget.combatHp !== undefined ? actualTarget.combatHp : actualTarget.currentHp;
                    if ((targetHp - damage) > 0 && (targetHp - damage) < (actualTarget.maxHp * 0.25)) {
                        damage = targetHp;
                        rollNote += ` **Executed!**`;
                    }
                }

                result.message = `**${user.name}** uses **${abilityData.name}** and rolls **${attackRoll}+${attackBonus}=${totalAttack}** vs AC ${targetAC}${isCrit ? ' (CRIT!)' : ''} - hits **${actualTarget.name}** for **${damage}** ${abilityData.damageType || ''} damage!${rollNote}`;

                // Reckless Attack: enemies get advantage against you next round
                if (abilityData.effect?.giveAdvantage) {
                    user.debuffs.push({ name: 'Reckless', effect: 'enemyAdvantage', duration: 1 });
                    result.message += ` (Enemies have advantage against ${user.name} until next turn)`;
                }
            }

            // Monster immunity/resistance for single-target abilities
            if (!actualTarget.odiscordUserId && abilityData.damageType) {
                if (hasMonsterImmunity(actualTarget, abilityData.damageType)) {
                    result.message = `**${user.name}** uses **${abilityData.name}** but **${actualTarget.name}** is **immune to ${abilityData.damageType}**!`;
                    break;
                }
                const monsterRes = getMonsterResistance(actualTarget, abilityData.damageType);
                if (monsterRes > 0) {
                    damage = Math.floor(damage * (1 - monsterRes));
                    damage = Math.max(1, damage);
                }
                actualTarget.lastDamageType = abilityData.damageType;
            }

            const dmgResult = applyDamage(combat, damage, actualTarget);
            if (dmgResult.relentlessRage) {
                result.message += ` **${actualTarget.name}** refuses to fall! (Relentless Rage)`;
            }
            if (dmgResult.killed) {
                result.message += ` **${actualTarget.name}** is defeated!`;
            }
            break;
        }
        case 'attack_multi': {
            // Attack multiple targets (e.g., Multiattack, Swift Quiver)
            const numTargets = abilityData.targets || 2;
            const damageFormula = resolveAbilityDamage(abilityData, user);
            const aliveMonsters = combat.monsters.filter(m => (m.combatHp || m.currentHp) > 0);
            const killed = [];
            const hits = [];
            const attackBonus = getAttackBonus(user);
            const bonusDmg = getBuffBonusDamage(user);

            for (let i = 0; i < numTargets && aliveMonsters.length > 0; i++) {
                const t = aliveMonsters[i % aliveMonsters.length];
                let attackRoll = Math.floor(Math.random() * 20) + 1;
                // Halfling Lucky: reroll natural 1s
                if (attackRoll === 1 && userRacialEffects.rerollOnes) {
                    attackRoll = Math.floor(Math.random() * 20) + 1;
                }
                const isCrit = attackRoll === 20;
                const isMiss = attackRoll === 1;
                const totalAttack = attackRoll + attackBonus;
                let targetAC = t.ac || t.armorClass || 10;
                if (t.defending) targetAC += 2;
                targetAC += getBuffAC(t);

                if (isMiss || (!isCrit && totalAttack < targetAC)) {
                    hits.push(`${t.name} (miss)`);
                    continue;
                }

                let damage = rollDiceTotal(damageFormula);
                if (isCrit) damage += rollDiceTotal(damageFormula);
                damage += attackBonus;
                damage += bonusDmg.flat;
                if (bonusDmg.dice) damage += rollDiceTotal(bonusDmg.dice);
                if (t.defending) damage = Math.floor(damage * 0.5);

                // Get damage type from ability or weapon
                const dmgType = abilityData.damageType || user.equipment?.weapon?.damageType || 'slashing';

                // Monster immunity check
                if (!t.odiscordUserId && hasMonsterImmunity(t, dmgType)) {
                    hits.push(`${t.name} (immune)`);
                    continue;
                }
                // Monster resistance check
                if (!t.odiscordUserId) {
                    const monsterRes = getMonsterResistance(t, dmgType);
                    if (monsterRes > 0) {
                        damage = Math.floor(damage * (1 - monsterRes));
                    }
                    t.lastDamageType = dmgType;
                }

                damage = Math.max(1, damage);

                const dmgRes = applyDamage(combat, damage, t);
                hits.push(`${t.name} for **${damage}**${isCrit ? ' (CRIT!)' : ''}`);
                if (dmgRes.killed) {
                    killed.push(t.name);
                    const idx = aliveMonsters.indexOf(t);
                    if (idx !== -1) aliveMonsters.splice(idx, 1);
                }
            }

            result.message = `**${user.name}** uses **${abilityData.name}**, striking ${numTargets} times! ${hits.join(', ')}.`;
            if (killed.length > 0) {
                result.message += ` Defeated: ${killed.join(', ')}`;
            }
            break;
        }
        case 'attack_aoe': {
            const damageFormula = resolveAbilityDamage(abilityData, user);
            let damage = rollDiceTotal(damageFormula);
            // Gnome Arcane Knowledge: +1 ability damage
            if (userRacialEffects.abilityDamageBonus) {
                damage += userRacialEffects.abilityDamageBonus;
            }
            let targets = combat.monsters.filter(m => (m.combatHp || m.currentHp) > 0);

            // Filter by targetType if specified (e.g., Turn Undead targets undead only)
            if (abilityData.targetType) {
                const typeTargets = targets.filter(m =>
                    m.type?.toLowerCase() === abilityData.targetType.toLowerCase()
                );
                if (typeTargets.length > 0) {
                    targets = typeTargets;
                }
            }

            // Cap targets if ability specifies a limit (e.g., Cleave hits 2)
            if (abilityData.targets && targets.length > abilityData.targets) {
                targets = targets.slice(0, abilityData.targets);
            }

            const killed = [];

            for (const t of targets) {
                let actualDmg = damage;
                // Check if target has Evasion buff (avoid AoE)
                if (hasBuff(t, 'Evasion')) {
                    actualDmg = 0;
                    continue;
                }
                // Monster immunity check
                if (!t.odiscordUserId && abilityData.damageType && hasMonsterImmunity(t, abilityData.damageType)) {
                    continue; // Skip immune monsters
                }
                // Monster resistance check
                if (!t.odiscordUserId && abilityData.damageType) {
                    const monsterRes = getMonsterResistance(t, abilityData.damageType);
                    if (monsterRes > 0) {
                        actualDmg = Math.floor(actualDmg * (1 - monsterRes));
                    }
                }
                if (t.defending) actualDmg = Math.floor(actualDmg * 0.5);
                const resistance = getDamageResistance(t, abilityData.damageType);
                if (resistance > 0) actualDmg = Math.floor(actualDmg * (1 - resistance));
                actualDmg = Math.max(1, actualDmg);
                // Track damage type for regeneration
                if (!t.odiscordUserId && abilityData.damageType) {
                    t.lastDamageType = abilityData.damageType;
                }

                const dmgRes = applyDamage(combat, actualDmg, t);
                if (dmgRes.killed) {
                    killed.push(t.name);
                }
            }

            const typeNote = abilityData.targetType ? ` (${abilityData.targetType} only)` : '';
            result.message = `**${user.name}** uses **${abilityData.name}**, hitting ${targets.length} enemies for **${damage}** ${abilityData.damageType || ''} damage!${typeNote}`;
            if (killed.length > 0) {
                result.message += ` Defeated: ${killed.join(', ')}`;
            }
            break;
        }
        case 'heal': {
            const healFormula = abilityData.amount
                .replace('wisdom', getModifier(user.stats.wisdom).toString())
                .replace('level', user.level.toString());
            const healAmount = rollDiceTotal(healFormula);
            const actualTarget = target || user;

            const maxHp = actualTarget.maxHp;
            const currentHp = actualTarget.combatHp !== undefined ? actualTarget.combatHp : actualTarget.currentHp;
            const wasDowned = currentHp <= 0;
            const newHp = Math.min(maxHp, currentHp + healAmount);

            if (actualTarget.combatHp !== undefined) {
                actualTarget.combatHp = newHp;
            } else {
                actualTarget.currentHp = newHp;
            }

            // Revive downed player
            if (wasDowned && newHp > 0) {
                markAlive(combat.turnOrder, actualTarget.id || actualTarget.odiscordUserId);
            }

            result.message = `**${user.name}** uses **${abilityData.name}** on **${actualTarget.name}**, restoring **${newHp - currentHp}** HP!`;
            if (wasDowned && newHp > 0) {
                result.message += ` **${actualTarget.name}** is back on their feet!`;
            }
            break;
        }
        case 'heal_aoe': {
            // Heal all party members (e.g., Prayer of Healing)
            const healFormula = abilityData.amount
                .replace('wisdom', getModifier(user.stats.wisdom).toString())
                .replace('level', user.level.toString());
            const healAmount = rollDiceTotal(healFormula);
            const healed = [];
            const revived = [];

            for (const p of combat.players) {
                const currentHp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
                const wasDowned = currentHp <= 0;
                const newHp = Math.min(p.maxHp, currentHp + healAmount);
                const actualHeal = newHp - currentHp;

                if (actualHeal > 0) {
                    if (p.combatHp !== undefined) {
                        p.combatHp = newHp;
                    } else {
                        p.currentHp = newHp;
                    }
                    healed.push(`${p.name} (+${actualHeal})`);

                    if (wasDowned && newHp > 0) {
                        markAlive(combat.turnOrder, p.id || p.odiscordUserId);
                        revived.push(p.name);
                    }
                }
            }

            result.message = `**${user.name}** uses **${abilityData.name}**, healing the party for **${healAmount}** HP! Healed: ${healed.join(', ')}`;
            if (revived.length > 0) {
                result.message += ` Revived: ${revived.join(', ')}!`;
            }
            break;
        }
        case 'revive': {
            // Revive a fallen ally (e.g., Revivify)
            const actualTarget = target;
            if (!actualTarget) {
                result.message = `**${user.name}** tries to use **${abilityData.name}** but there is no target!`;
                result.success = false;
                break;
            }

            const currentHp = actualTarget.combatHp !== undefined ? actualTarget.combatHp : actualTarget.currentHp;
            if (currentHp > 0) {
                result.message = `**${actualTarget.name}** is not downed!`;
                result.success = false;
                // Refund cooldown
                user.cooldowns[ability] = 0;
                break;
            }

            if (actualTarget.combatHp !== undefined) {
                actualTarget.combatHp = 1;
            } else {
                actualTarget.currentHp = 1;
            }
            markAlive(combat.turnOrder, actualTarget.id || actualTarget.odiscordUserId);

            result.message = `**${user.name}** uses **${abilityData.name}** on **${actualTarget.name}**! They return to life with 1 HP!`;
            break;
        }
        case 'buff': {
            // Check requiresBuff (e.g., Frenzy requires Rage)
            if (abilityData.requiresBuff) {
                const requiredBuff = abilityData.requiresBuff;
                const requiredAbility = abilities[user.class]?.[requiredBuff];
                const requiredName = requiredAbility?.name || requiredBuff;
                if (!hasBuff(user, requiredName)) {
                    result.message = `**${user.name}** can't use **${abilityData.name}** without **${requiredName}** active!`;
                    result.success = false;
                    user.cooldowns[ability] = 0; // Refund cooldown
                    break;
                }
            }

            user.buffs.push({
                name: abilityData.name,
                effect: abilityData.effect,
                duration: abilityData.duration || 3
            });

            // Special: extra_attack buff grants a bonus action this turn
            if (abilityData.effect === 'extra_attack') {
                user.extraAttack = true;
                result.message = `**${user.name}** uses **${abilityData.name}**! They can attack again this turn!`;
            } else {
                result.message = `**${user.name}** uses **${abilityData.name}**! ${abilityData.description}`;
            }
            break;
        }
        case 'defensive': {
            user.buffs.push({
                name: abilityData.name,
                effect: abilityData.effect,
                duration: abilityData.duration || 1
            });
            result.message = `**${user.name}** uses **${abilityData.name}**! ${abilityData.description}`;
            break;
        }
        case 'reaction': {
            user.buffs.push({
                name: abilityData.name,
                effect: abilityData.effect,
                duration: abilityData.duration || 1
            });
            result.message = `**${user.name}** uses **${abilityData.name}**! ${abilityData.description}`;
            break;
        }
        case 'passive': {
            // Passive abilities don't need to be "used" - just acknowledge
            result.message = `**${abilityData.name}** is a passive ability that is always active.`;
            result.success = false;
            // Refund cooldown
            user.cooldowns[ability] = 0;
            break;
        }
        default:
            result.message = `**${user.name}** uses **${abilityData.name}**!`;
    }

    return result;
}

/**
 * Process monster AI turn
 */
function processMonsterTurn(combat, monster) {
    // Check if monster is stunned - skip turn
    if (hasCondition(monster, 'stunned')) {
        return {
            attacker: monster.name,
            target: null,
            hit: false,
            damage: 0,
            killed: false,
            message: `**${monster.name}** is **stunned** and loses their turn!`
        };
    }

    // Find alive players
    const alivePlayers = combat.players.filter(p => (p.combatHp || p.currentHp) > 0);
    if (alivePlayers.length === 0) return null;

    // Step 1: Move monster toward/away from players based on role
    const moveResult = monsterMovement(combat, monster);
    let moveMessage = '';
    if (moveResult && moveResult.success) {
        moveMessage = `*${monster.name} moves.* `;
    }

    // Step 2: Check for ready special attacks (breath weapons, gaze, etc.)
    const readySpecials = getReadySpecialAttacks(monster);
    if (readySpecials.length > 0) {
        // Use a special attack with some probability (60% if available)
        const useSpecial = Math.random() < 0.6;
        if (useSpecial) {
            const special = readySpecials[Math.floor(Math.random() * readySpecials.length)];
            const specialResult = processSpecialAttack(combat, monster, special, alivePlayers);
            // Set cooldown
            if (special.cooldown) {
                if (!monster.cooldowns) monster.cooldowns = {};
                monster.cooldowns[special.name] = special.cooldown;
            }
            if (moveMessage) {
                specialResult.message = moveMessage + specialResult.message;
            }
            return specialResult;
        }
    }

    // Step 3: Select target (weighted towards lower HP)
    const weights = alivePlayers.map(p => {
        const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
        return Math.max(1, p.maxHp - hp + 10); // Prefer damaged targets
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let targetIndex = 0;

    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            targetIndex = i;
            break;
        }
    }

    const target = alivePlayers[targetIndex];

    // Step 4: Select attack based on range to target
    const attack = selectAttackInRange(monster, target);

    if (!attack) {
        // No attack in range - just report movement
        if (moveMessage) {
            return {
                attacker: monster.name,
                target: target.name,
                hit: false,
                damage: 0,
                killed: false,
                message: `${moveMessage}**${monster.name}** has no attack in range!`
            };
        }
        return null;
    }

    const result = processAttack(combat, monster, target, attack);

    // Prepend move message
    if (moveMessage) {
        result.message = moveMessage + result.message;
    }

    return result;
}

/**
 * Process a monster special attack (breath weapon, gaze, AoE, etc.)
 */
function processSpecialAttack(combat, monster, special, alivePlayers) {
    const result = {
        attacker: monster.name,
        target: null,
        hit: true,
        damage: 0,
        killed: false,
        message: ''
    };

    const damage = rollDiceTotal(special.damage || '0');
    const damageType = special.damageType || 'magical';

    if (special.aoe) {
        // AoE attack - hits all alive players (e.g., breath weapons)
        const killed = [];
        const hitResults = [];

        for (const player of alivePlayers) {
            let actualDmg = damage;

            // Saving throw for half damage
            if (special.saveDC && special.saveStat) {
                const save = rollSavingThrow(player, special.saveStat, special.saveDC);
                if (save.success) {
                    actualDmg = Math.floor(actualDmg * 0.5);
                    hitResults.push(`${player.name} (saved, ${actualDmg} dmg)`);
                } else {
                    hitResults.push(`${player.name} (${actualDmg} dmg)`);
                }
            } else {
                hitResults.push(`${player.name} (${actualDmg} dmg)`);
            }

            // Check Evasion buff
            if (hasBuff(player, 'Evasion')) {
                actualDmg = 0;
                hitResults[hitResults.length - 1] = `${player.name} (evaded!)`;
            }

            // Apply defend reduction
            if (player.defending) {
                actualDmg = Math.floor(actualDmg * 0.5);
            }

            // Apply buff damage resistance (e.g., Rage) and armor
            const resistance = getDamageResistance(player, damageType);
            if (resistance > 0) {
                actualDmg = Math.floor(actualDmg * (1 - resistance));
            }

            actualDmg = Math.max(0, actualDmg);
            if (actualDmg > 0) {
                const dmgRes = applyDamage(combat, actualDmg, player);
                if (dmgRes.killed) killed.push(player.name);
            }

            // Apply condition if the special has one (e.g., petrifying gaze)
            if (special.effect && special.saveDC) {
                const condSave = rollSavingThrow(player, special.saveStat || 'constitution', special.saveDC);
                if (!condSave.success) {
                    applyCondition(player, special.effect, special.duration || 1);
                }
            }
        }

        result.damage = damage;
        result.message = `**${monster.name}** uses **${special.name}**! ${special.description || ''} Hits: ${hitResults.join(', ')}.`;
        if (killed.length > 0) {
            result.message += ` Defeated: ${killed.join(', ')}!`;
            result.killed = true;
        }
    } else {
        // Single-target special attack (e.g., petrifying gaze, energy drain)
        // Pick lowest HP target
        const target = alivePlayers.reduce((a, b) => {
            const hpA = a.combatHp !== undefined ? a.combatHp : a.currentHp;
            const hpB = b.combatHp !== undefined ? b.combatHp : b.currentHp;
            return hpA <= hpB ? a : b;
        });

        let actualDmg = damage;

        // Saving throw
        if (special.saveDC && special.saveStat) {
            const save = rollSavingThrow(target, special.saveStat, special.saveDC);
            if (save.success) {
                actualDmg = Math.floor(actualDmg * 0.5);
                result.message = `**${monster.name}** uses **${special.name}** on **${target.name}**! ${target.name} saves (${save.total} vs DC ${special.saveDC}) and takes **${actualDmg}** ${damageType} damage!`;
            } else {
                result.message = `**${monster.name}** uses **${special.name}** on **${target.name}**! ${target.name} fails the save (${save.total} vs DC ${special.saveDC}) and takes **${actualDmg}** ${damageType} damage!`;
                // Apply condition on failed save
                if (special.effect) {
                    applyCondition(target, special.effect, special.duration || 1);
                    result.message += ` **${target.name}** is **${special.effect}**!`;
                }
            }
        } else {
            result.message = `**${monster.name}** uses **${special.name}** on **${target.name}** for **${actualDmg}** ${damageType} damage!`;
        }

        if (actualDmg > 0) {
            // Apply defend/resistance
            if (target.defending) actualDmg = Math.floor(actualDmg * 0.5);
            const resistance = getDamageResistance(target, damageType);
            if (resistance > 0) actualDmg = Math.floor(actualDmg * (1 - resistance));
            actualDmg = Math.max(1, actualDmg);

            const dmgRes = applyDamage(combat, actualDmg, target);
            if (dmgRes.killed) {
                result.killed = true;
                result.message += ` **${target.name}** is defeated!`;
            }
        }

        result.target = target.name;
        result.damage = actualDmg;
    }

    return result;
}

/**
 * End turn and advance to next
 */
function endTurn(combat) {
    const current = getCurrentCombatant(combat);
    if (current) {
        current.defending = false; // Reset defend at end of turn

        // Reduce cooldowns
        if (current.cooldowns) {
            for (const ability in current.cooldowns) {
                if (current.cooldowns[ability] > 0) {
                    current.cooldowns[ability]--;
                }
            }
        }

        // Reduce buff durations
        if (current.buffs) {
            current.buffs = current.buffs.filter(b => {
                b.duration--;
                return b.duration > 0;
            });
        }

        // Reduce debuff durations
        if (current.debuffs) {
            current.debuffs = current.debuffs.filter(d => {
                d.duration--;
                return d.duration > 0;
            });
        }

        // Reduce condition durations (stunned, weakened, etc.)
        if (current.conditions) {
            current.conditions = current.conditions.filter(c => {
                c.duration--;
                return c.duration > 0;
            });
        }

        // Player accessory regeneration (e.g., Ring of Regeneration)
        if (current.odiscordUserId && current.equipment?.accessory?.effect?.type === 'regen') {
            const hp = current.combatHp !== undefined ? current.combatHp : current.currentHp;
            const maxHp = current.maxHp;
            if (hp > 0 && hp < maxHp) {
                const regenAmount = current.equipment.accessory.effect.amount || 1;
                const healAmount = Math.min(regenAmount, maxHp - hp);
                if (current.combatHp !== undefined) {
                    current.combatHp += healAmount;
                } else {
                    current.currentHp += healAmount;
                }
                combat.log.push(`**${current.name}** regenerates **${healAmount}** HP! (Ring of Regeneration)`);
            }
        }

        // Monster regeneration (e.g., Troll regenerates 5 HP unless hit by fire/acid)
        if (!current.odiscordUserId) {
            const regenAbilities = getMonsterAbilities(current, 'regeneration');
            for (const regen of regenAbilities) {
                const hp = current.combatHp !== undefined ? current.combatHp : current.currentHp;
                const maxHp = current.maxHp;
                if (hp > 0 && hp < maxHp) {
                    // Check if regeneration is prevented by last damage type
                    const prevented = regen.preventedBy && regen.preventedBy.includes(current.lastDamageType);
                    if (!prevented) {
                        const healAmount = Math.min(regen.amount || 5, maxHp - hp);
                        if (current.combatHp !== undefined) {
                            current.combatHp += healAmount;
                        } else {
                            current.currentHp += healAmount;
                        }
                        combat.log.push(`**${current.name}** regenerates **${healAmount}** HP!`);
                    }
                }
                // Reset last damage type for next round
                current.lastDamageType = null;
            }
        }
    }

    const { newIndex, newRound, combatEnded } = advanceTurn(combat.turnOrder, combat.currentTurnIndex);

    if (combatEnded) {
        return { ended: true };
    }

    combat.currentTurnIndex = newIndex;
    if (newRound) {
        combat.round++;
    }

    // Reset movement for the next combatant
    const nextCombatant = getCurrentCombatant(combat);
    if (nextCombatant) {
        resetMovement(nextCombatant);
    }

    return { ended: false, newRound };
}

/**
 * Check and resolve combat end
 */
function resolveCombatEnd(combat) {
    const endState = checkCombatEnd(combat.turnOrder);

    if (endState.ended) {
        combat.status = endState.victory ? 'victory' : 'defeat';

        if (endState.victory) {
            // Generate loot from defeated monsters
            for (const monster of combat.monsters) {
                const loot = generateMonsterLoot(monster, combat.room?.difficulty || 1);
                combat.loot.push(loot);
            }
        }
    }

    return endState;
}

/**
 * Get consolidated combat rewards
 */
function getCombatRewards(combat) {
    return consolidateLoot(combat.loot);
}

/**
 * Get alive players in combat
 */
function getAlivePlayers(combat) {
    return combat.players.filter(p => (p.combatHp || p.currentHp) > 0);
}

/**
 * Get downed players in combat (0 or below HP)
 */
function getDownedPlayers(combat) {
    return combat.players.filter(p => {
        const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
        return hp <= 0;
    });
}

/**
 * Get alive monsters in combat
 */
function getAliveMonsters(combat) {
    return combat.monsters.filter(m => (m.combatHp || m.currentHp) > 0);
}

module.exports = {
    createCombat,
    getCurrentCombatant,
    isPlayerTurn,
    processAttack,
    processDefend,
    processUseItem,
    processUseAbility,
    processMonsterTurn,
    getDownedPlayers,
    endTurn,
    resolveCombatEnd,
    getCombatRewards,
    getAlivePlayers,
    getAliveMonsters
};
