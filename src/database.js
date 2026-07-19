const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let db = null;
let dbPath = null;

/**
 * Initialize database connection
 */
async function init() {
    if (db) return db;
    
    dbPath = path.resolve(config.DATABASE_PATH);
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // Load existing DB or create new one
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
        console.log('✅ Database loaded from file');
    } else {
        db = new SQL.Database();
        console.log('🆕 New database created');
    }
    
    // Create tables
    createTables();
    
    // Save initial state
    save();
    
    return db;
}

/**
 * Create database schema
 */
function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
            channel_id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_activity TEXT NOT NULL,
            claimed_by TEXT,
            closed INTEGER DEFAULT 0,
            closed_at TEXT,
            rating INTEGER,
            locked INTEGER DEFAULT 0,
            lock_reason TEXT,
            lock_by TEXT,
            lock_at TEXT,
            message_id TEXT
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS staff_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            note TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS ratings (
            channel_id TEXT PRIMARY KEY,
            stars INTEGER NOT NULL,
            rated_at TEXT NOT NULL,
            owner_id TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS staff_last_seen (
            user_id TEXT PRIMARY KEY,
            last_seen TEXT NOT NULL
        )
    `);

 db.run(`
        CREATE TABLE IF NOT EXISTS counters (
            channel_id TEXT PRIMARY KEY,
            number INTEGER DEFAULT 0,
            last_user_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
    `);
    
    // Leaderboard table
    db.run(`
        CREATE TABLE IF NOT EXISTS counter_leaderboard (
            user_id TEXT PRIMARY KEY,
            total_count INTEGER DEFAULT 0,
            streak_current INTEGER DEFAULT 0,
            streak_best INTEGER DEFAULT 0,
            first_number TEXT,
            last_active TEXT
        )
    `);

    db.run(`
    CREATE TABLE IF NOT EXISTS counters (
        channel_id TEXT PRIMARY KEY,
        number INTEGER DEFAULT 0,
        last_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        reset_by TEXT,     
        reset_reason TEXT   
    )
`);
}

// ===== SAVE FUNCTION =====

function save() {
    if (!db || !dbPath) return;
    
    try {
        const binaryArray = db.export();
        const buffer = Buffer.from(binaryArray);
        fs.writeFileSync(dbPath, buffer);
    } catch (err) {
        console.error('⚠️ Failed to save database:', err.message);
    }
}

// ===== TICKET OPERATIONS =====

function createTicket(data) {
    const stmt = `
        INSERT OR REPLACE INTO tickets (
            channel_id, owner_id, category, created_at, last_activity,
            claimed_by, closed, closed_at, rating, locked,
            lock_reason, lock_by, lock_at, message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(stmt, [
        String(data.channelId),      // ⭐ ALS STRING SPEICHERN! ⭐
        String(data.ownerId),
        data.category,
        data.createdAt,
        data.lastActivity,
        data.claimedBy || null,
        data.closed ? 1 : 0,
        data.closedAt || null,
        data.rating || null,
        data.locked ? 1 : 0,
        data.lockReason || null,
        data.lockedBy || null,
        data.lockedAt || null,
        data.messageId || null,
    ]);
    
    save();
}

function getTicket(channelId) {
    // ⭐ SURE WE HAVE STRING! ⭐
    const channelIdStr = String(channelId);
    
    const stmt = `SELECT * FROM tickets WHERE channel_id = ?`;
    const result = db.exec(stmt, [channelIdStr]);
    
    if (!result || result.length === 0) return null;
    
    const row = result[0].values[0];
    const columns = result[0].columns;
    
    const ticket = {};
    columns.forEach((col, i) => {
        ticket[col] = row[i];
    });
    
    // ⭐ ENSURE channel_id IS STRING FOR CONSISTENCY ⭐
    ticket.channel_id = String(ticket.channel_id);
    ticket.owner_id = String(ticket.owner_id);
    
    return ticket;
}

function updateTicket(channelId, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }
    
    values.push(channelId);
    
    const stmt = `UPDATE tickets SET ${fields.join(', ')} WHERE channel_id = ?`;
    db.run(stmt, values);
    
    save();
}

function getAllTickets() {
    const result = db.exec('SELECT * FROM tickets');
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const ticket = {};
        columns.forEach((col, i) => {
            ticket[col] = row[i];
        });
        return ticket;
    });
}

function getOpenTickets() {
    const result = db.exec('SELECT * FROM tickets WHERE closed = 0');
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const ticket = {};
        columns.forEach((col, i) => {
            ticket[col] = row[i];
        });
        return ticket;
    });
}

function deleteTicket(channelId) {
    db.run('DELETE FROM tickets WHERE channel_id = ?', [channelId]);
    save();
}

// ===== STAFF NOTES OPERATIONS =====

function addNote(data) {
    db.run(
        `INSERT INTO staff_notes (channel_id, author_id, author_name, note, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [data.channelId, data.authorId, data.authorName, data.note, data.timestamp]
    );
    save();
}

function getNotes(channelId) {
    const result = db.exec(
        `SELECT * FROM staff_notes WHERE channel_id = ? ORDER BY timestamp ASC`,
        [channelId]
    );
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const note = {};
        columns.forEach((col, i) => {
            note[col] = row[i];
        });
        return note;
    });
}

// ===== RATING OPERATIONS =====

function addRating(data) {
    db.run(
        `INSERT OR REPLACE INTO ratings (channel_id, stars, rated_at, owner_id)
         VALUES (?, ?, ?, ?)`,
        [data.channelId, data.stars, data.ratedAt, data.ownerId]
    );
    save();
}

function getRating(channelId) {
    const result = db.exec('SELECT * FROM ratings WHERE channel_id = ?', [channelId]);
    
    if (!result || result.length === 0) return null;
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const rating = {};
    columns.forEach((col, i) => {
        rating[col] = row[i];
    });
    
    return rating;
}

// ===== BATCH OPERATIONS =====

function batchCloseTickets(channelIds) {
    const placeholders = channelIds.map(() => '?').join(',');
    const stmt = `UPDATE tickets SET closed = 1, closed_at = datetime('now'), last_activity = datetime('now') WHERE channel_id IN (${placeholders})`;
    
    db.run(stmt, channelIds);
    save();
}

// ===== MIGRATION =====

function migrateFromJSON(jsonData) {
    let count = 0;
    
    for (const [channelId, ticket] of Object.entries(jsonData.tickets || {})) {
        // Skip if already exists
        if (getTicket(channelId)) continue;
        
        // Insert ticket
        createTicket({
            channelId: ticket.channelId,
            ownerId: ticket.ownerId,
            category: ticket.category,
            createdAt: ticket.createdAt,
            lastActivity: ticket.lastActivity,
            claimedBy: ticket.claimedBy,
            closed: ticket.closed ? 1 : 0,
            closedAt: ticket.closedAt,
            rating: ticket.rating,
            locked: ticket.locked ? 1 : 0,
            lockReason: ticket.lockReason,
            lockBy: ticket.lockedBy || ticket.lockBy,
            lockedAt: ticket.lockedAt || ticket.lockAt,
            messageId: ticket.messageId
        });
        count++;
    }
    
    // Migrate ratings
    for (const [channelId, rating] of Object.entries(jsonData.ratings || {})) {
        addRating({
            channelId,
            stars: rating.stars,
            ratedAt: rating.ratedAt,
            ownerId: rating.ownerId
        });
    }
    
    return count;
}

// ===== UTILITIES =====

function close() {
    if (db) {
        save();
        db = null;
    }
}

// ===== ASSIGNED TICKETS TRACKING =====

function getTicketsClaimedBy(userId) {
    const userIdStr = String(userId);
    const result = db.exec(
        `SELECT * FROM tickets WHERE claimed_by = ? AND closed = 0 ORDER BY created_at DESC`,
        [userIdStr]
    );
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const ticket = {};
        columns.forEach((col, i) => {
            ticket[col] = row[i];
        });
        ticket.channel_id = String(ticket.channel_id);
        ticket.owner_id = String(ticket.owner_id);
        ticket.claimed_by = ticket.claimed_by ? String(ticket.claimed_by) : null;
        return ticket;
    });
}

function getLastSeen(userId) {
    const userIdStr = String(userId);
    const result = db.exec(
        `SELECT last_seen FROM staff_last_seen WHERE user_id = ?`,
        [userIdStr]
    );
    
    if (!result || result.length === 0) return null;
    return result[0].values[0][0];
}

function setLastSeen(userId, timestamp) {
    const userIdStr = String(userId);
    db.run(
        `INSERT OR REPLACE INTO staff_last_seen (user_id, last_seen) VALUES (?, ?)`,
        [userIdStr, timestamp]
    );
    save();
}

// ===== COUNTER SYSTEM =====

function getCounter(channelId) {
    const channelIdStr = String(channelId);
    const result = db.exec(
        `SELECT * FROM counters WHERE channel_id = ?`,
        [channelIdStr]
    );
    
    if (!result || result.length === 0) return null;
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const counter = {};
    columns.forEach((col, i) => {
        counter[col] = row[i];
    });
    
    return counter;
}

function initCounter(channelId, ownerId) {
    const channelIdStr = String(channelId);
    const ownerIdStr = String(ownerId);
    
    db.run(
        `INSERT INTO counters (channel_id, number, last_user_id, created_at) 
         VALUES (?, 0, ?, datetime('now'))`,
        [channelIdStr, ownerIdStr]
    );
    
    save();
}

function incrementCounter(channelId, userId) {
    const channelIdStr = String(channelId);
    const userIdStr = String(userId);
    
    db.run(
        `UPDATE counters SET number = number + 1, last_user_id = ?, updated_at = datetime('now') 
         WHERE channel_id = ?`,
        [userIdStr, channelIdStr]
    );
    
    save();
}

function resetCounter(channelId, adminId) {
    const channelIdStr = String(channelId);
    const adminIdStr = String(adminId);
    
    db.run(
        `UPDATE counters SET number = 0, last_user_id = ?, updated_at = datetime('now') 
         WHERE channel_id = ?`,
        [adminIdStr, channelIdStr]
    );
    
    save();
}

function getAllCounters() {
    const result = db.exec(`SELECT * FROM counters ORDER BY number DESC LIMIT 100`);
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const counter = {};
        columns.forEach((col, i) => {
            counter[col] = row[i];
        });
        counter.channel_id = String(counter.channel_id);
        counter.last_user_id = String(counter.last_user_id);
        return counter;
    });
}



module.exports = {
    init,
    close,
    
    // Tickets
    createTicket,
    getTicket,
    updateTicket,
    getAllTickets,
    getOpenTickets,
    deleteTicket,
    batchCloseTickets,
    
    // Staff Notes
    addNote,
    getNotes,
    
    // Ratings
    addRating,
    getRating,
    
    // Migration
    migrateFromJSON,

    getTicketsClaimedBy,
    getLastSeen,
    setLastSeen,

    getCounter,
    initCounter,
    incrementCounter,
    resetCounter,
    getAllCounters,
};