const { getCharacter, saveCharacter, getParty } = require('../../utils/persistence');
const { initSession, getSession, updateSession, deleteSession } = require('../../utils/crawlState');
const { generateDungeon, getCurrentRoom } = require('../dungeon/generator');
const { createCombat, getAlivePlayers, getAliveMonsters } = require('../combat/combatManager');
const { renderGrid } = require('../combat/grid');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

/**
 * Handle the ~crawl start command
 * @param {Message} msg
 * @param {string[]} args
 */
async function handleStart(msg, args) {
    const guildId = msg.guild.id;
    const odiscordUserId = msg.author.id;

    // Check if player has a character
    const character = await getCharacter(guildId, odiscordUserId);
    if (!character) {
        return msg.reply('You don\'t have a character yet! Use `~crawl create` first.');
    }

    // Check for rest cooldown (solo)
    const { checkRestCooldown } = require('./rest');
    const cooldownCheck = checkRestCooldown(character);
    if (cooldownCheck.onCooldown) {
        return msg.reply(`**${character.name}** is still recovering from their rest. Ready in **${cooldownCheck.remainingText}**.`);
    }

    // Check if in a party
    const party = await getParty(guildId, odiscordUserId);

    if (party) {
        // Party dungeon
        if (party.leaderId !== odiscordUserId) {
            return msg.reply('Only the party leader can start the dungeon! Ask them to use `~crawl start`.');
        }

        // Check if any party member is already in a dungeon
        for (const memberId of party.members) {
            const existingSession = getSession(guildId, memberId);
            if (existingSession) {
                const memberName = party.memberNames[memberId] || 'A party member';
                return msg.reply(`${memberName} is already in a dungeon! They need to finish or retreat first.`);
            }
        }

        // Load all party member characters and check cooldowns
        const partyCharacters = [];
        for (const memberId of party.members) {
            const memberChar = await getCharacter(guildId, memberId);
            if (!memberChar) {
                const memberName = party.memberNames[memberId] || 'A party member';
                return msg.reply(`${memberName} doesn't have a character! They need to use \`~crawl create\` first.`);
            }

            // Check for rest cooldown
            const memberCooldown = checkRestCooldown(memberChar);
            if (memberCooldown.onCooldown) {
                return msg.reply(`**${memberChar.name}** is still recovering from their rest. Ready in **${memberCooldown.remainingText}**.`);
            }

            // Restore HP if dead
            if (memberChar.currentHp <= 0) {
                memberChar.currentHp = Math.floor(memberChar.maxHp * 0.25);
                await saveCharacter(guildId, memberId, memberChar);
            }

            partyCharacters.push(memberChar);
        }

        // Calculate average party level for dungeon difficulty
        const avgLevel = Math.round(partyCharacters.reduce((sum, c) => sum + c.level, 0) / partyCharacters.length);
        const dungeon = generateDungeon(avgLevel, partyCharacters.length);

        // Create session for each party member (all point to same dungeon)
        const sessionData = {
            channelId: msg.channel.id,
            odiscordUserId: party.leaderId,
            dungeon,
            combat: null,
            characters: partyCharacters,
            partyMemberIds: party.members,
            isParty: true,
            status: 'exploring',
            startedAt: Date.now()
        };

        // Initialize session for leader (main session)
        const session = initSession(guildId, party.leaderId, sessionData);

        // Create linked sessions for other party members
        for (const memberId of party.members) {
            if (memberId !== party.leaderId) {
                initSession(guildId, memberId, {
                    ...sessionData,
                    linkedTo: party.leaderId // Points to leader's session
                });
            }
        }

        // Show dungeon entry for party
        const embed = createPartyDungeonEntryEmbed(partyCharacters, dungeon, party);
        const buttons = createDungeonEntryButtons(party.leaderId);

        const reply = await msg.reply({
            content: party.members.map(id => `<@${id}>`).join(' '),
            embeds: [embed],
            components: buttons
        });

        session.messageId = reply.id;
        updateSession(guildId, party.leaderId, session);

    } else {
        // Solo dungeon (original behavior)
        const existingSession = getSession(guildId, odiscordUserId);
        if (existingSession) {
            return msg.reply('You\'re already in a dungeon! Finish it or use the retreat button to leave.');
        }

        if (character.currentHp <= 0) {
            character.currentHp = Math.floor(character.maxHp * 0.25);
            await saveCharacter(guildId, odiscordUserId, character);
        }

        const dungeon = generateDungeon(character.level, 1);

        const session = initSession(guildId, odiscordUserId, {
            channelId: msg.channel.id,
            odiscordUserId,
            dungeon,
            combat: null,
            characters: [character],
            isParty: false,
            status: 'exploring',
            startedAt: Date.now()
        });

        const embed = createDungeonEntryEmbed(character, dungeon);
        const buttons = createDungeonEntryButtons(odiscordUserId);

        const reply = await msg.reply({
            embeds: [embed],
            components: buttons
        });

        session.messageId = reply.id;
        updateSession(guildId, odiscordUserId, session);
    }
}

/**
 * Create embed for party dungeon entry
 */
function createPartyDungeonEntryEmbed(characters, dungeon, party) {
    const partyList = characters.map(c => {
        const isLeader = c.odiscordUserId === party.leaderId;
        return `${isLeader ? '👑 ' : ''}**${c.name}** (Lv.${c.level} ${c.class}) - ${c.currentHp}/${c.maxHp} HP`;
    }).join('\n');

    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle(`Dungeon: ${dungeon.name}`)
        .setDescription(`Your party stands before the entrance to **${dungeon.name}**...\n\n*${dungeon.description}*`)
        .addFields(
            { name: 'Party Members', value: partyList, inline: false },
            { name: 'Difficulty', value: `${dungeon.difficulty}`, inline: true },
            { name: 'Rooms', value: `${dungeon.totalRooms}`, inline: true },
            { name: 'Party Size', value: `${characters.length}`, inline: true }
        )
        .setFooter({ text: 'Party leader: Click Enter Dungeon when ready!' });
}

/**
 * Enter the first room and start encounter
 */
async function enterDungeon(interaction, odiscordUserId) {
    const guildId = interaction.guild.id;
    const session = getSession(guildId, odiscordUserId);

    if (!session) {
        return interaction.reply({ content: 'No active dungeon session.', ephemeral: true });
    }

    const dungeon = session.dungeon;
    const room = getCurrentRoom(dungeon);

    session.status = 'in_room';

    // Handle room based on type (pass all characters for party support)
    await handleRoom(interaction, session, room);
}

/**
 * Handle room encounter based on type
 */
async function handleRoom(interaction, session, room) {
    const guildId = interaction.guild.id;
    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;

    switch (room.type) {
        case 'combat':
        case 'boss':
            await startCombat(interaction, session, room);
            break;

        case 'treasure':
            await handleTreasureRoom(interaction, session, room);
            break;

        case 'trap':
            await handleTrapRoom(interaction, session, room);
            break;

        case 'rest':
            await handleRestRoom(interaction, session, room);
            break;

        case 'empty':
            await handleEmptyRoom(interaction, session, room);
            break;

        default:
            await handleEmptyRoom(interaction, session, room);
    }

    updateSession(guildId, leaderId, session);
}

/**
 * Start combat in a room
 */
async function startCombat(interaction, session, room) {
    const { getCurrentCombatant, processMonsterTurn, endTurn, resolveCombatEnd } = require('../combat/combatManager');

    // Use all characters in the session (party or solo)
    const combat = createCombat(session.characters, room.monsters, room);
    session.combat = combat;
    session.status = 'combat';

    // Process any monster turns at the start (if monsters have higher initiative)
    let currentCombatant = getCurrentCombatant(combat);

    while (currentCombatant && !currentCombatant.odiscordUserId) {
        // It's a monster's turn - process it
        const monsterResult = processMonsterTurn(combat, currentCombatant);
        if (monsterResult) {
            combat.log.push(monsterResult.message);
            combat.lastAction = monsterResult;
        }

        // Check if combat ended (all players died)
        const combatEnd = resolveCombatEnd(combat);
        if (combatEnd.ended) {
            if (!combatEnd.victory) {
                await handleDefeat(interaction, session);
                return;
            }
            break;
        }

        // End monster turn and get next combatant
        endTurn(combat);
        currentCombatant = getCurrentCombatant(combat);
    }

    const guildId = interaction.guild.id;
    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    updateSession(guildId, leaderId, session);

    const embed = createCombatEmbed(session);

    // Get current player's turn for buttons
    const currentTurn = getCurrentCombatant(combat);
    const currentPlayerId = currentTurn?.odiscordUserId || leaderId;
    const buttons = createCombatButtons(currentPlayerId, session);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

/**
 * Handle treasure room
 */
async function handleTreasureRoom(interaction, session, room) {
    const { generateTreasureLoot } = require('../dungeon/loot');
    const loot = generateTreasureLoot(session.dungeon.difficulty);

    // Add gold to session rewards (for end summary)
    session.dungeon.rewards.totalGold += loot.gold;

    // For party: distribute items to random party members
    // For solo: add to the single character
    for (const item of loot.items) {
        const randomChar = session.characters[Math.floor(Math.random() * session.characters.length)];
        addItemToInventory(randomChar, item);
    }

    room.cleared = true;

    // Build items display with type indicators
    let itemsText = 'None';
    if (loot.items.length > 0) {
        itemsText = loot.items.map(i => {
            if (i.type === 'weapon') return `⚔️ ${i.name}`;
            if (i.type === 'armor') return `🛡️ ${i.name}`;
            if (i.type === 'consumable') return `🧪 ${i.name}`;
            return i.name;
        }).join('\n');
    }

    const description = session.isParty
        ? room.description + '\n\n*Items distributed among party members!*'
        : room.description + '\n\n*Items added to your inventory!*';

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`Room ${session.dungeon.currentRoom + 1}: ${room.name}`)
        .setDescription(description)
        .addFields(
            { name: 'Gold Found', value: `${loot.gold} gold`, inline: true },
            { name: 'Items Found', value: itemsText, inline: true }
        )
        .setFooter({ text: `Room ${session.dungeon.currentRoom + 1} of ${session.dungeon.totalRooms}` });

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    const buttons = createProceedButtons(leaderId, session);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

/**
 * Add an item to character inventory, stacking consumables
 */
function addItemToInventory(character, item) {
    if (!character.inventory) {
        character.inventory = [];
    }

    // Consumables stack
    if (item.type === 'consumable') {
        const existing = character.inventory.find(i => i.id === item.id && i.type === 'consumable');
        if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
            return;
        }
    }

    // Equipment and new items get added
    character.inventory.push({ ...item, quantity: item.quantity || 1 });
}

/**
 * Handle trap room
 */
async function handleTrapRoom(interaction, session, room) {
    const { getModifier, rollDiceTotal } = require('../../utils/dice');

    const results = [];
    let anyoneTriggered = false;
    let allDead = true;

    // Each party member rolls their own save
    for (const character of session.characters) {
        const dexMod = getModifier(character.stats.dexterity);
        const saveRoll = Math.floor(Math.random() * 20) + 1;
        const totalSave = saveRoll + dexMod;
        const success = totalSave >= room.trap.dc;

        if (success) {
            results.push(`**${character.name}** avoids the trap! (${saveRoll}+${dexMod}=${totalSave} vs DC ${room.trap.dc})`);
        } else {
            anyoneTriggered = true;
            const damage = rollDiceTotal(room.trap.damage);
            character.currentHp = Math.max(0, character.currentHp - damage);
            results.push(`**${character.name}** triggers the trap! Took **${damage}** ${room.trap.type} damage. (${saveRoll}+${dexMod}=${totalSave} vs DC ${room.trap.dc})`);
        }

        if (character.currentHp > 0) {
            allDead = false;
        }
    }

    room.cleared = true;
    room.trap.triggered = anyoneTriggered;

    // Build party HP status
    const hpStatus = session.characters.map(c =>
        `**${c.name}**: ${c.currentHp}/${c.maxHp} HP`
    ).join('\n');

    const embed = new EmbedBuilder()
        .setColor(anyoneTriggered ? 0xFF0000 : 0x00FF00)
        .setTitle(`Room ${session.dungeon.currentRoom + 1}: ${room.name}`)
        .setDescription(room.description)
        .addFields(
            { name: 'Results', value: results.join('\n'), inline: false },
            { name: 'Party Status', value: hpStatus, inline: false }
        )
        .setFooter({ text: `Room ${session.dungeon.currentRoom + 1} of ${session.dungeon.totalRooms}` });

    // Check if all players died
    if (allDead) {
        session.status = 'defeat';
        embed.setColor(0x000000).addFields({ name: 'Status', value: 'The party has fallen...', inline: false });
        await interaction.update({ embeds: [embed], components: [] });
        await handleDefeat(interaction, session);
        return;
    }

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    const buttons = createProceedButtons(leaderId, session);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

/**
 * Handle rest room
 */
async function handleRestRoom(interaction, session, room) {
    const healResults = [];

    // Heal all party members
    for (const character of session.characters) {
        const healAmount = Math.min(room.healAmount, character.maxHp - character.currentHp);
        character.currentHp = Math.min(character.maxHp, character.currentHp + room.healAmount);
        healResults.push(`**${character.name}** recovers **${healAmount}** HP (${character.currentHp}/${character.maxHp})`);
    }

    room.cleared = true;

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`Room ${session.dungeon.currentRoom + 1}: ${room.name}`)
        .setDescription(room.description)
        .addFields(
            { name: 'Rest', value: healResults.join('\n'), inline: false }
        )
        .setFooter({ text: `Room ${session.dungeon.currentRoom + 1} of ${session.dungeon.totalRooms}` });

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    const buttons = createProceedButtons(leaderId, session);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

/**
 * Handle empty room
 */
async function handleEmptyRoom(interaction, session, room) {
    room.cleared = true;

    const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle(`Room ${session.dungeon.currentRoom + 1}: ${room.name}`)
        .setDescription(room.description)
        .addFields(
            { name: 'Status', value: 'Nothing of interest here.', inline: false }
        )
        .setFooter({ text: `Room ${session.dungeon.currentRoom + 1} of ${session.dungeon.totalRooms}` });

    const leaderId = session.isParty ? session.odiscordUserId : session.characters[0].odiscordUserId;
    const buttons = createProceedButtons(leaderId, session);

    await interaction.update({
        embeds: [embed],
        components: buttons
    });
}

/**
 * Proceed to next room
 */
async function proceedToNextRoom(interaction, odiscordUserId) {
    const guildId = interaction.guild.id;
    const session = getSession(guildId, odiscordUserId);

    if (!session) {
        return interaction.reply({ content: 'No active dungeon session.', ephemeral: true });
    }

    const { advanceRoom } = require('../dungeon/generator');
    const canAdvance = advanceRoom(session.dungeon);

    if (!canAdvance) {
        // Dungeon complete!
        await handleVictory(interaction, session);
        return;
    }

    const room = getCurrentRoom(session.dungeon);

    await handleRoom(interaction, session, room);
}

/**
 * Retreat from dungeon
 */
async function retreat(interaction, odiscordUserId) {
    const guildId = interaction.guild.id;
    const session = getSession(guildId, odiscordUserId);

    if (!session) {
        return interaction.reply({ content: 'No active dungeon session.', ephemeral: true });
    }

    const dungeon = session.dungeon;

    // Keep 75% of rewards when retreating
    const goldKept = Math.floor(dungeon.rewards.totalGold * 0.75);
    const xpKept = Math.floor(dungeon.rewards.totalXp * 0.75);

    // Distribute rewards among all party members
    const partySize = session.characters.length;
    const goldPerPlayer = Math.floor(goldKept / partySize);
    const xpPerPlayer = Math.floor(xpKept / partySize);

    const characterNames = [];
    for (const character of session.characters) {
        character.gold += goldPerPlayer;
        character.xp += xpPerPlayer;
        await saveCharacter(guildId, character.odiscordUserId, character);
        characterNames.push(character.name);
    }

    // Clean up sessions for all party members
    if (session.isParty && session.partyMemberIds) {
        for (const memberId of session.partyMemberIds) {
            deleteSession(guildId, memberId);
        }
    } else {
        deleteSession(guildId, odiscordUserId);
    }

    const description = session.isParty
        ? `The party retreats from the dungeon with their loot.`
        : `**${characterNames[0]}** retreats from the dungeon with their loot.`;

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('Tactical Retreat!')
        .setDescription(description)
        .addFields(
            { name: 'Gold Kept', value: `${goldKept} (75%)${session.isParty ? ` (${goldPerPlayer} each)` : ''}`, inline: true },
            { name: 'XP Kept', value: `${xpKept} (75%)${session.isParty ? ` (${xpPerPlayer} each)` : ''}`, inline: true },
            { name: 'Rooms Cleared', value: `${dungeon.currentRoom} of ${dungeon.totalRooms}`, inline: true }
        )
        .setFooter({ text: 'Use ~crawl start to try again!' });

    await interaction.update({ embeds: [embed], components: [] });
}

/**
 * Handle dungeon victory
 */
async function handleVictory(interaction, session) {
    const guildId = interaction.guild.id;
    const dungeon = session.dungeon;
    const { generateCompletionBonus, addLootToCharacter } = require('../dungeon/loot');
    const { awardXp, applyLevelUp } = require('../character/leveling');

    // Calculate completion bonus
    const bonus = generateCompletionBonus(dungeon.totalRooms, dungeon.difficulty);
    dungeon.rewards.totalGold += bonus.bonusGold;
    dungeon.rewards.totalXp += bonus.bonusXp;

    // Calculate per-player rewards
    const partySize = session.characters.length;
    const goldPerPlayer = Math.floor(dungeon.rewards.totalGold / partySize);
    const xpPerPlayer = Math.floor(dungeon.rewards.totalXp / partySize);

    const playerResults = [];
    const allLevelUps = [];

    // Distribute rewards to all party members
    for (const character of session.characters) {
        const playerLoot = {
            gold: goldPerPlayer,
            xp: xpPerPlayer,
            items: [] // Items were already distributed during dungeon
        };

        addLootToCharacter(character, playerLoot);
        character.dungeonsCompleted++;
        character.lastPlayed = Date.now();

        // Award XP and check for level up
        const xpResult = awardXp(character, playerLoot.xp);
        character.xp = xpResult.newXp;

        // Apply any level ups
        const characterLevelUps = [];
        for (let lvl = xpResult.oldLevel + 1; lvl <= xpResult.newLevel; lvl++) {
            const levelUpInfo = applyLevelUp(character, lvl);
            characterLevelUps.push(levelUpInfo.levelUpInfo);
        }

        if (characterLevelUps.length > 0) {
            allLevelUps.push({
                name: character.name,
                levelUps: characterLevelUps
            });
        }

        // Sync combat HP back to character
        const combatPlayer = session.combat?.players?.find(p => p.odiscordUserId === character.odiscordUserId);
        if (combatPlayer) {
            character.currentHp = combatPlayer.combatHp;
        }

        await saveCharacter(guildId, character.odiscordUserId, character);
        playerResults.push(`**${character.name}** +${goldPerPlayer}g +${xpResult.xpGained}xp`);
    }

    // Clean up sessions for all party members
    if (session.isParty && session.partyMemberIds) {
        for (const memberId of session.partyMemberIds) {
            deleteSession(guildId, memberId);
        }
    } else {
        deleteSession(guildId, session.characters[0].odiscordUserId);
    }

    const description = session.isParty
        ? `The party has conquered the dungeon!`
        : `**${session.characters[0].name}** has conquered the dungeon!`;

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('Dungeon Complete!')
        .setDescription(description)
        .addFields(
            { name: 'Total Gold', value: `${dungeon.rewards.totalGold}`, inline: true },
            { name: 'Total XP', value: `${dungeon.rewards.totalXp}`, inline: true },
            { name: 'Items Found', value: dungeon.rewards.items?.length > 0 ? dungeon.rewards.items.map(i => i.name).join(', ') : 'None', inline: false }
        );

    if (session.isParty) {
        embed.addFields({
            name: 'Party Rewards',
            value: playerResults.join('\n'),
            inline: false
        });
    }

    // Show level ups
    let hasStatPoints = false;
    if (allLevelUps.length > 0) {
        const levelUpTexts = allLevelUps.map(({ name, levelUps }) => {
            const lastLevelUp = levelUps[levelUps.length - 1];
            let text = `**${name}** is now level ${lastLevelUp.newLevel}! (+${levelUps.reduce((sum, l) => sum + l.hpGained, 0)} HP)`;
            if (lastLevelUp.newAbility) {
                text += `\n  New ability: **${lastLevelUp.newAbility.name}**`;
            }
            if (lastLevelUp.statPoints > 0) {
                text += `\n  +${lastLevelUp.statPoints} stat points!`;
                hasStatPoints = true;
            }
            return text;
        });

        embed.addFields({
            name: '🎉 LEVEL UP!',
            value: levelUpTexts.join('\n'),
            inline: false
        });
    }

    const footerText = hasStatPoints
        ? 'Use ~crawl levelup to allocate stat points!'
        : 'Use ~crawl start for another adventure!';
    embed.setFooter({ text: footerText });

    // Try to update, if already deferred then edit original message
    try {
        await interaction.update({ embeds: [embed], components: [] });
    } catch (e) {
        if (session.messageId && interaction.channel) {
            const originalMessage = await interaction.channel.messages.fetch(session.messageId);
            await originalMessage.edit({ embeds: [embed], components: [] });
        }
    }
}

/**
 * Handle player defeat
 */
async function handleDefeat(interaction, session) {
    const guildId = interaction.guild.id;
    const dungeon = session.dungeon;

    // Keep 25% of rewards on defeat
    const goldKept = Math.floor(dungeon.rewards.totalGold * 0.25);
    const xpKept = Math.floor(dungeon.rewards.totalXp * 0.25);

    // Distribute salvaged rewards among party
    const partySize = session.characters.length;
    const goldPerPlayer = Math.floor(goldKept / partySize);
    const xpPerPlayer = Math.floor(xpKept / partySize);

    const characterNames = [];
    for (const character of session.characters) {
        character.gold += goldPerPlayer;
        character.xp += xpPerPlayer;
        character.currentHp = 1; // Revive with 1 HP
        await saveCharacter(guildId, character.odiscordUserId, character);
        characterNames.push(character.name);
    }

    // Clean up sessions for all party members
    if (session.isParty && session.partyMemberIds) {
        for (const memberId of session.partyMemberIds) {
            deleteSession(guildId, memberId);
        }
    } else {
        deleteSession(guildId, session.characters[0].odiscordUserId);
    }

    const description = session.isParty
        ? `The party has fallen in the dungeon.`
        : `**${characterNames[0]}** has fallen in the dungeon.`;

    const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Defeat...')
        .setDescription(description)
        .addFields(
            { name: 'Gold Salvaged', value: `${goldKept} (25%)${session.isParty ? ` (${goldPerPlayer} each)` : ''}`, inline: true },
            { name: 'XP Salvaged', value: `${xpKept} (25%)${session.isParty ? ` (${xpPerPlayer} each)` : ''}`, inline: true }
        )
        .setFooter({ text: 'You wake up at the dungeon entrance. Use ~crawl start to try again!' });

    // Try to update, if already deferred then edit original message
    try {
        await interaction.update({ embeds: [embed], components: [] });
    } catch (e) {
        // Interaction was already deferred, edit the original message
        if (session.messageId && interaction.channel) {
            const originalMessage = await interaction.channel.messages.fetch(session.messageId);
            await originalMessage.edit({ embeds: [embed], components: [] });
        }
    }
}

// ============================================
// Embed Creators
// ============================================

function createDungeonEntryEmbed(character, dungeon) {
    return new EmbedBuilder()
        .setColor(0x7B2D26)
        .setTitle('Entering the Dungeon...')
        .setDescription(`**${character.name}** stands at the entrance of a dark dungeon.`)
        .addFields(
            { name: 'Character', value: `Level ${character.level} ${character.race} ${character.class}`, inline: true },
            { name: 'HP', value: `${character.currentHp}/${character.maxHp}`, inline: true },
            { name: 'Difficulty', value: `Level ${dungeon.difficulty}`, inline: true },
            { name: 'Rooms', value: `${dungeon.totalRooms} rooms to clear`, inline: true }
        )
        .setFooter({ text: 'Click "Enter Dungeon" to begin your adventure!' });
}

function createCombatEmbed(session) {
    const combat = session.combat;
    const dungeon = session.dungeon;
    const room = getCurrentRoom(dungeon);

    // Party status
    const partyStatus = combat.players.map(p => {
        const hp = p.combatHp !== undefined ? p.combatHp : p.currentHp;
        const hpBar = createHpBar(hp, p.maxHp);
        return `**${p.name}** ${hpBar} ${hp}/${p.maxHp}`;
    }).join('\n');

    // Monster status
    const monsterStatus = combat.monsters.map(m => {
        const hp = m.combatHp !== undefined ? m.combatHp : m.currentHp;
        const hpBar = createHpBar(hp, m.maxHp);
        return `**${m.name}** ${hpBar} ${hp}/${m.maxHp}`;
    }).join('\n');

    // Current turn
    const currentTurn = combat.turnOrder[combat.currentTurnIndex];
    const turnText = currentTurn ? `**${currentTurn.name}'s Turn**` : 'Combat';

    // Combat log - show last 8 actions with visual separators
    const recentLog = combat.log.slice(-8);
    const combatLog = recentLog.length > 0
        ? recentLog.map((entry, i) => `${i + 1}. ${entry}`).join('\n')
        : room.description;

    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(`Room ${dungeon.currentRoom + 1}: ${room.name}`)
        .setDescription(turnText)
        .addFields(
            { name: 'Party', value: partyStatus || 'None', inline: true },
            { name: 'Enemies', value: monsterStatus || 'None', inline: true },
            { name: 'Round', value: `${combat.round}`, inline: true }
        );

    // Add tactical grid if available
    if (combat.grid) {
        embed.addFields({
            name: 'Battlefield',
            value: '```\n' + renderGrid(combat) + '```',
            inline: false
        });
    }

    embed.addFields(
        { name: 'Combat Log', value: combatLog.substring(0, 1024), inline: false }
    ).setFooter({ text: `Room ${dungeon.currentRoom + 1} of ${dungeon.totalRooms}` });

    return embed;
}

function createHpBar(current, max, length = 10) {
    const filled = Math.max(0, Math.round((current / max) * length));
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

// ============================================
// Button Creators
// ============================================

function createDungeonEntryButtons(odiscordUserId) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_startdungeon_${odiscordUserId}`)
            .setLabel('Enter Dungeon')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚔️'),
        new ButtonBuilder()
            .setCustomId(`crawl_cancel_${odiscordUserId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

function createCombatButtons(odiscordUserId, session) {
    const combat = session.combat;
    const currentTurn = combat.turnOrder[combat.currentTurnIndex];

    // Only show buttons if it's this player's turn
    if (!currentTurn || !currentTurn.isPlayer || currentTurn.odiscordUserId !== odiscordUserId) {
        return [];
    }

    // Single "Take Action" button that opens ephemeral action menu
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_actionmenu_${odiscordUserId}`)
            .setLabel('Take Action')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️')
    );

    return [row];
}

function createProceedButtons(odiscordUserId, session) {
    const dungeon = session.dungeon;
    const isLastRoom = dungeon.currentRoom >= dungeon.totalRooms - 1;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`crawl_proceed_${odiscordUserId}`)
            .setLabel(isLastRoom ? 'Exit Dungeon' : 'Next Room')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➡️'),
        new ButtonBuilder()
            .setCustomId(`crawl_partyinv_${odiscordUserId}`)
            .setLabel('Inventory')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎒'),
        new ButtonBuilder()
            .setCustomId(`crawl_retreat_${odiscordUserId}`)
            .setLabel('Retreat')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🚪')
    );

    return [row];
}

module.exports = {
    handleStart,
    enterDungeon,
    handleRoom,
    startCombat,
    proceedToNextRoom,
    retreat,
    handleVictory,
    handleDefeat,
    createCombatEmbed,
    createCombatButtons,
    createProceedButtons,
    addItemToInventory
};
