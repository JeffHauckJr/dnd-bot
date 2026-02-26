const mongoose = require('mongoose');

// Character Schema
const characterSchema = new mongoose.Schema({
    odiscordUserId: { type: String, required: true },
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    race: { type: String, required: true },
    class: { type: String, required: true },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    xpToNextLevel: { type: Number, default: 300 },
    stats: {
        strength: { type: Number, default: 10 },
        dexterity: { type: Number, default: 10 },
        constitution: { type: Number, default: 10 },
        intelligence: { type: Number, default: 10 },
        wisdom: { type: Number, default: 10 },
        charisma: { type: Number, default: 10 }
    },
    maxHp: { type: Number, default: 10 },
    currentHp: { type: Number, default: 10 },
    armorClass: { type: Number, default: 10 },
    abilities: [{ type: String }],
    equipment: {
        weapon: { type: mongoose.Schema.Types.Mixed, default: null },
        armor: { type: mongoose.Schema.Types.Mixed, default: null },
        accessory: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    inventory: [{ type: mongoose.Schema.Types.Mixed }],
    gold: { type: Number, default: 50 },
    createdAt: { type: Date, default: Date.now },
    lastPlayed: { type: Date, default: Date.now },
    dungeonsCompleted: { type: Number, default: 0 },
    monstersSlain: { type: Number, default: 0 },
    pendingStatPoints: { type: Number, default: 0 }
});

// Compound index for unique character per user per guild
characterSchema.index({ odiscordUserId: 1, guildId: 1 }, { unique: true });

// Party Schema
const partySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    leaderId: { type: String, required: true },
    leaderName: { type: String, default: 'Unknown' },
    members: [{ type: String }],
    memberNames: { type: mongoose.Schema.Types.Mixed, default: {} },
    maxSize: { type: Number, default: 4 },
    status: { type: String, enum: ['forming', 'in_dungeon', 'disbanded'], default: 'forming' },
    createdAt: { type: Date, default: Date.now }
});

// Create models
const Character = mongoose.model('Character', characterSchema);
const Party = mongoose.model('Party', partySchema);

// Connection state
let isConnected = false;

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 */
async function connectDatabase() {
    if (isConnected) {
        console.log('[Database] Already connected');
        return;
    }

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        console.error('[Database] MONGODB_URI not found in environment variables!');
        console.log('[Database] Falling back to local JSON storage (data will not persist on Railway)');
        return;
    }

    try {
        await mongoose.connect(mongoUri);
        isConnected = true;
        console.log('[Database] Connected to MongoDB');
    } catch (error) {
        console.error('[Database] Connection error:', error.message);
        console.log('[Database] Falling back to local JSON storage');
    }
}

/**
 * Check if database is connected
 * @returns {boolean}
 */
function isDatabaseConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
    if (isConnected) {
        await mongoose.disconnect();
        isConnected = false;
        console.log('[Database] Disconnected from MongoDB');
    }
}

module.exports = {
    connectDatabase,
    disconnectDatabase,
    isDatabaseConnected,
    Character,
    Party
};
