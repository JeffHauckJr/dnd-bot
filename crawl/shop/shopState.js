/**
 * Shop State Management
 * Handles the rotating shop inventory per guild
 */

const ROTATION_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

// In-memory shop rotations per guild
// Map<guildId, { items: ShopItems, rotatedAt: number }>
const shopRotations = new Map();

/**
 * Get or generate shop items for a guild
 * @param {string} guildId
 * @returns {{ items: object, rotatedAt: number, timeUntilRotation: number }}
 */
function getShopRotation(guildId) {
    const now = Date.now();
    let rotation = shopRotations.get(guildId);

    // Check if rotation exists and is still valid
    if (!rotation || now - rotation.rotatedAt >= ROTATION_INTERVAL) {
        // Generate new rotation
        const { generateRotation } = require('./shopManager');
        const items = generateRotation();
        rotation = {
            items,
            rotatedAt: now
        };
        shopRotations.set(guildId, rotation);
    }

    const timeUntilRotation = ROTATION_INTERVAL - (now - rotation.rotatedAt);

    return {
        items: rotation.items,
        rotatedAt: rotation.rotatedAt,
        timeUntilRotation: Math.max(0, timeUntilRotation)
    };
}

/**
 * Format time until rotation as human-readable string
 * @param {number} ms - Milliseconds until rotation
 * @returns {string}
 */
function formatTimeUntilRotation(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

/**
 * Force a new rotation for testing purposes
 * @param {string} guildId
 */
function forceRotation(guildId) {
    shopRotations.delete(guildId);
    return getShopRotation(guildId);
}

/**
 * Clear all rotations (used on bot restart if needed)
 */
function clearAllRotations() {
    shopRotations.clear();
}

module.exports = {
    getShopRotation,
    formatTimeUntilRotation,
    forceRotation,
    clearAllRotations,
    ROTATION_INTERVAL
};
