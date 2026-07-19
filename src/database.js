const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let db = null;
let dbPath = null;

async function init() {
    if (db) return db;
    
    dbPath = path.resolve(config.DATABASE_PATH);
    
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const SQL = await initSqlJs();
    
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
        console.log('✅ Database loaded from file');
    } else {
        db = new SQL.Database();
        console.log('🆕 New database created');
    }
    
    createTables();
    save();
    
    return db;
}

function createTables() {
    db.exec(`
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
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS staff_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            note TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    `);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS ratings (
            channel_id TEXT PRIMARY KEY,
            stars INTEGER NOT NULL,
            rated_at TEXT NOT NULL,
            owner_id TEXT NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS staff_last_seen (
            user_id TEXT PRIMARY KEY,
            last_seen TEXT NOT NULL
        )
    `);

    db.exec(`
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
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS counter_leaderboard (
            user_id TEXT PRIMARY KEY,
            total_count INTEGER DEFAULT 0,
            streak_current INTEGER DEFAULT 0,
            streak_best INTEGER DEFAULT 0,
            first_number TEXT,
            last_active TEXT
        )
    `);

    // Migration: Add missing columns to counters table
    try { db.exec(`ALTER TABLE counters ADD COLUMN reset_by TEXT`); } catch(e) {}
    try { db.exec(`ALTER TABLE counters ADD COLUMN reset_reason TEXT`); } catch(e) {}

}

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

// Helper function to execute with params
function run(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
}

// Helper function to get data with params
function get(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    const result = db.exec(sql, params);
    if (!result || result.length === 0) return null;
    const row = result[0].values[0];
    const columns = result[0].columns;
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
}

function createTicket(data) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO tickets (
            channel_id, owner_id, category, created_at, last_activity,
            claimed_by, closed, closed_at, rating, locked,
            lock_reason, lock_by, lock_at, message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.bind([
        String(data.channelId),
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
    
    stmt.step();
    stmt.free();
    save();
}

function getTicket(channelId) {
    const channelIdStr = String(channelId);
    const result = db.exec(`SELECT * FROM tickets WHERE channel_id = ?`, [channelIdStr]);
    
    if (!result || result.length === 0) return null;
    
    const row = result[0].values[0];
    const columns = result[0].columns;
    const ticket = {};
    columns.forEach((col, i) => { ticket[col] = row[i]; });
    
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
    
    const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE channel_id = ?`);
    stmt.bind(values);
    stmt.step();
    stmt.free();
    
    save();
}

function getAllTickets() {
    const result = db.exec('SELECT * FROM tickets');
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const ticket = {};
        columns.forEach((col, i) => { ticket[col] = row[i]; });
        return ticket;
    });
}

function getOpenTickets() {
    const result = db.exec('SELECT * FROM tickets WHERE closed = 0');
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const ticket = {};
        columns.forEach((col, i) => { ticket[col] = row[i]; });
        return ticket;
    });
}

function deleteTicket(channelId) {
    const stmt = db.prepare('DELETE FROM tickets WHERE channel_id = ?');
    stmt.bind([channelId]);
    stmt.step();
    stmt.free();
    save();
}

function addNote(data) {
    const stmt = db.prepare(`
        INSERT INTO staff_notes (channel_id, author_id, author_name, note, timestamp)
         VALUES (?, ?, ?, ?, ?)
    `);
    stmt.bind([data.channelId, data.authorId, data.authorName, data.note, data.timestamp]);
    stmt.step();
    stmt.free();
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
        columns.forEach((col, i) => { note[col] = row[i]; });
        return note;
    });
}

function addRating(data) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO ratings (channel_id, stars, rated_at, owner_id)
         VALUES (?, ?, ?, ?)
    `);
    stmt.bind([data.channelId, data.stars, data.ratedAt, data.ownerId]);
    stmt.step();
    stmt.free();
    save();
}

function getRating(channelId) {
    const result = db.exec('SELECT * FROM ratings WHERE channel_id = ?', [channelId]);
    
    if (!result || result.length === 0) return null;
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const rating = {};
    columns.forEach((col, i) => { rating[col] = row[i]; });
    
    return rating;
}

function batchCloseTickets(channelIds) {
    const placeholders = channelIds.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE tickets SET closed = 1, closed_at = datetime('now'), last_activity = datetime('now') WHERE channel_id IN (${placeholders})`);
    stmt.bind(channelIds);
    stmt.step();
    stmt.free();
    save();
}

function migrateFromJSON(jsonData) {
    let count = 0;
    
    for (const [channelId, ticket] of Object.entries(jsonData.tickets || {})) {
        if (getTicket(channelId)) continue;
        
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

function close() {
    if (db) {
        save();
        db = null;
    }
}

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
        columns.forEach((col, i) => { ticket[col] = row[i]; });
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
    const stmt = db.prepare(
        `INSERT OR REPLACE INTO staff_last_seen (user_id, last_seen) VALUES (?, ?)`
    );
    stmt.bind([userIdStr, timestamp]);
    stmt.step();
    stmt.free();
    save();
}

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
    columns.forEach((col, i) => { counter[col] = row[i]; });
    
    return counter;
}

function initCounter(channelId, ownerId) {
    const channelIdStr = String(channelId);
    
    // ⭐ last_user_id = NULL (jeder darf mit 1 anfangen!) ⭐
    const stmt = db.prepare(
        `INSERT INTO counters (channel_id, number, last_user_id, created_at) 
         VALUES (?, 0, NULL, datetime('now'))`
    );
    stmt.bind([channelIdStr]);
    stmt.step();
    stmt.free();
    
    save();
}

function incrementCounter(channelId, userId) {
    const channelIdStr = String(channelId);
    const userIdStr = String(userId);
    
    const stmt = db.prepare(
        `UPDATE counters SET number = number + 1, last_user_id = ?, updated_at = datetime('now') 
         WHERE channel_id = ?`
    );
    stmt.bind([userIdStr, channelIdStr]);
    stmt.step();
    stmt.free();
    
    save();
}

function resetCounter(channelId, adminId) {
    const channelIdStr = String(channelId);
    const adminIdStr = String(adminId);
    
    const stmt = db.prepare(
        `UPDATE counters SET number = 0, last_user_id = ?, updated_at = datetime('now') 
         WHERE channel_id = ?`
    );
    stmt.bind([adminIdStr, channelIdStr]);
    stmt.step();
    stmt.free();
    
    save();
}

function getAllCounters() {
    const result = db.exec(`SELECT * FROM counters ORDER BY number DESC LIMIT 100`);
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const counter = {};
        columns.forEach((col, i) => { counter[col] = row[i]; });
        counter.channel_id = String(counter.channel_id);
        counter.last_user_id = String(counter.last_user_id);
        return counter;
    });
}

// ===== RAW DB ACCESS WRAPPERS (for external modules) =====
function prepare(sql) {
    if (!db) throw new Error('Database not initialized');
    return db.prepare(sql);
}

function exec(sql, params) {
    if (!db) throw new Error('Database not initialized');
    if (params && params.length > 0) {
        return db.exec(sql, params);
    }
    return db.exec(sql);
}

function run(sql, params) {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
        stmt.bind(params);
    }
    stmt.step();
    stmt.free();
}

module.exports = {
    init,
    close,
    save,         // ← NEU
    prepare,      // ← NEU
    exec,         // ← NEU
    run,          // ← NEU
    
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