const fs = require('fs').promises;
const path = require('path');
const { isDatabaseConnected, Character, Party } = require('./database');

const DATA_DIR = path.join(__dirname, '..', 'data', 'guilds');

// ============================================
// Character Operations
// ============================================

/**
 * Get a character by guild and user ID
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @returns {Promise<object|null>}
 */
async function getCharacter(guildId, odiscordUserId) {
    if (isDatabaseConnected()) {
        const character = await Character.findOne({ guildId, odiscordUserId }).lean();
        return character;
    } else {
        // Fallback to JSON
        const characters = await loadCharactersFromFile(guildId);
        return characters[odiscordUserId] || null;
    }
}

/**
 * Save a character
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @param {object} characterData
 * @returns {Promise<object>}
 */
async function saveCharacter(guildId, odiscordUserId, characterData) {
    if (isDatabaseConnected()) {
        const character = await Character.findOneAndUpdate(
            { guildId, odiscordUserId },
            { ...characterData, guildId, odiscordUserId },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        return character;
    } else {
        // Fallback to JSON
        const characters = await loadCharactersFromFile(guildId);
        characters[odiscordUserId] = characterData;
        await saveCharactersToFile(guildId, characters);
        return characterData;
    }
}

/**
 * Delete a character
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @returns {Promise<boolean>}
 */
async function deleteCharacter(guildId, odiscordUserId) {
    if (isDatabaseConnected()) {
        const result = await Character.deleteOne({ guildId, odiscordUserId });
        return result.deletedCount > 0;
    } else {
        // Fallback to JSON
        const characters = await loadCharactersFromFile(guildId);
        if (characters[odiscordUserId]) {
            delete characters[odiscordUserId];
            await saveCharactersToFile(guildId, characters);
            return true;
        }
        return false;
    }
}

/**
 * Get all characters in a guild
 * @param {string} guildId
 * @returns {Promise<object[]>}
 */
async function getGuildCharacters(guildId) {
    if (isDatabaseConnected()) {
        return await Character.find({ guildId }).lean();
    } else {
        const characters = await loadCharactersFromFile(guildId);
        return Object.values(characters);
    }
}

/**
 * Get leaderboard (top characters by level/xp)
 * @param {string} guildId
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function getLeaderboard(guildId, limit = 10) {
    if (isDatabaseConnected()) {
        return await Character.find({ guildId })
            .sort({ level: -1, xp: -1 })
            .limit(limit)
            .lean();
    } else {
        const characters = await loadCharactersFromFile(guildId);
        return Object.values(characters)
            .sort((a, b) => b.level - a.level || b.xp - a.xp)
            .slice(0, limit);
    }
}

// ============================================
// Party Operations
// ============================================

/**
 * Get a party by ID
 * @param {string} guildId
 * @param {string} odiscordUserId - Leader or member ID
 * @returns {Promise<object|null>}
 */
async function getParty(guildId, odiscordUserId) {
    if (isDatabaseConnected()) {
        return await Party.findOne({
            guildId,
            $or: [
                { leaderId: odiscordUserId },
                { members: odiscordUserId }
            ],
            status: { $ne: 'disbanded' }
        }).lean();
    } else {
        const parties = await loadPartiesFromFile(guildId);
        return Object.values(parties).find(p =>
            p.status !== 'disbanded' &&
            (p.leaderId === odiscordUserId || p.members.includes(odiscordUserId))
        ) || null;
    }
}

/**
 * Save a party
 * @param {string} guildId
 * @param {object} partyData
 * @returns {Promise<object>}
 */
async function saveParty(guildId, partyData) {
    if (isDatabaseConnected()) {
        // Use findOneAndUpdate with $set to properly update Mixed type fields
        const updateData = {
            leaderId: partyData.leaderId,
            leaderName: partyData.leaderName,
            members: partyData.members,
            memberNames: partyData.memberNames,
            maxSize: partyData.maxSize,
            status: partyData.status
        };

        const party = await Party.findOneAndUpdate(
            { guildId, leaderId: partyData.leaderId },
            { $set: updateData },
            { upsert: true, new: true }
        ).lean();

        return party;
    } else {
        const parties = await loadPartiesFromFile(guildId);
        const partyId = partyData.id || `${guildId}-${partyData.leaderId}`;
        parties[partyId] = { ...partyData, id: partyId };
        await savePartiesToFile(guildId, parties);
        return parties[partyId];
    }
}

/**
 * Delete/disband a party
 * @param {string} guildId
 * @param {string} leaderId
 * @returns {Promise<boolean>}
 */
async function deleteParty(guildId, leaderId) {
    if (isDatabaseConnected()) {
        const result = await Party.updateOne(
            { guildId, leaderId },
            { status: 'disbanded' }
        );
        return result.modifiedCount > 0;
    } else {
        const parties = await loadPartiesFromFile(guildId);
        const partyId = `${guildId}-${leaderId}`;
        if (parties[partyId]) {
            parties[partyId].status = 'disbanded';
            await savePartiesToFile(guildId, parties);
            return true;
        }
        return false;
    }
}

// ============================================
// JSON File Fallback Functions
// ============================================

async function ensureGuildDir(guildId) {
    const guildDir = path.join(DATA_DIR, guildId);
    await fs.mkdir(guildDir, { recursive: true });
    return guildDir;
}

async function loadCharactersFromFile(guildId) {
    const filePath = path.join(DATA_DIR, guildId, 'characters.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

async function saveCharactersToFile(guildId, characters) {
    await ensureGuildDir(guildId);
    const filePath = path.join(DATA_DIR, guildId, 'characters.json');
    await fs.writeFile(filePath, JSON.stringify(characters, null, 2));
}

async function loadPartiesFromFile(guildId) {
    const filePath = path.join(DATA_DIR, guildId, 'parties.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

async function savePartiesToFile(guildId, parties) {
    await ensureGuildDir(guildId);
    const filePath = path.join(DATA_DIR, guildId, 'parties.json');
    await fs.writeFile(filePath, JSON.stringify(parties, null, 2));
}

// Legacy exports for backwards compatibility
async function loadCharacters(guildId) {
    return await loadCharactersFromFile(guildId);
}

async function saveCharacters(guildId, characters) {
    return await saveCharactersToFile(guildId, characters);
}

async function loadParties(guildId) {
    return await loadPartiesFromFile(guildId);
}

async function saveParties(guildId, parties) {
    return await savePartiesToFile(guildId, parties);
}

module.exports = {
    // Main functions
    getCharacter,
    saveCharacter,
    deleteCharacter,
    getGuildCharacters,
    getLeaderboard,
    getParty,
    saveParty,
    deleteParty,
    // Legacy/fallback
    ensureGuildDir,
    loadCharacters,
    saveCharacters,
    loadParties,
    saveParties
};
