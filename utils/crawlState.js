/**
 * In-memory state manager for active dungeon sessions
 * Sessions are keyed by `${guildId}-${odiscordUserId}` for solo
 * or `${guildId}-party-${partyId}` for party runs
 */

const dungeonSessions = new Map();

// Session timeout (30 minutes of inactivity)
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Initialize a new dungeon session
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @param {object} sessionData
 * @returns {object} The session
 */
function initSession(guildId, odiscordUserId, sessionData) {
    const key = `${guildId}-${odiscordUserId}`;
    const session = {
        ...sessionData,
        key,
        guildId,
        odiscordUserId,
        lastActivity: Date.now()
    };
    dungeonSessions.set(key, session);
    return session;
}

/**
 * Get an existing session
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @returns {object|null}
 */
function getSession(guildId, odiscordUserId) {
    const key = `${guildId}-${odiscordUserId}`;
    const session = dungeonSessions.get(key);
    if (session) {
        session.lastActivity = Date.now();
    }
    return session || null;
}

/**
 * Update session data
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @param {object} updates
 * @returns {object|null}
 */
function updateSession(guildId, odiscordUserId, updates) {
    const session = getSession(guildId, odiscordUserId);
    if (!session) return null;

    Object.assign(session, updates, { lastActivity: Date.now() });
    return session;
}

/**
 * Delete a session
 * @param {string} guildId
 * @param {string} odiscordUserId
 */
function deleteSession(guildId, odiscordUserId) {
    const key = `${guildId}-${odiscordUserId}`;
    dungeonSessions.delete(key);
}

/**
 * Find session by Discord message ID (for button interactions)
 * @param {string} messageId
 * @returns {object|null} - { key, session } or null
 */
function getSessionByMessageId(messageId) {
    for (const [key, session] of dungeonSessions) {
        if (session.combat?.messageId === messageId || session.messageId === messageId) {
            session.lastActivity = Date.now();
            return { key, session };
        }
    }
    return null;
}

/**
 * Find session by custom interaction ID prefix
 * @param {string} sessionId - The session ID embedded in button customId
 * @returns {object|null}
 */
function getSessionById(sessionId) {
    const session = dungeonSessions.get(sessionId);
    if (session) {
        session.lastActivity = Date.now();
    }
    return session || null;
}

/**
 * Get all active sessions for a guild
 * @param {string} guildId
 * @returns {object[]}
 */
function getGuildSessions(guildId) {
    const sessions = [];
    for (const [key, session] of dungeonSessions) {
        if (session.guildId === guildId) {
            sessions.push(session);
        }
    }
    return sessions;
}

/**
 * Check if user is in an active dungeon
 * @param {string} guildId
 * @param {string} odiscordUserId
 * @returns {boolean}
 */
function isInDungeon(guildId, odiscordUserId) {
    return getSession(guildId, odiscordUserId) !== null;
}

/**
 * Clean up expired sessions (call periodically)
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [key, session] of dungeonSessions) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            dungeonSessions.delete(key);
            console.log(`[Crawl] Cleaned up expired session: ${key}`);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

module.exports = {
    dungeonSessions,
    initSession,
    getSession,
    updateSession,
    deleteSession,
    getSessionByMessageId,
    getSessionById,
    getGuildSessions,
    isInDungeon,
    cleanupExpiredSessions
};
