const db = require('../database');

function getUserCounterStats(userId) {
    const userIdStr = String(userId);
    const result = db.exec(
        `SELECT * FROM counter_leaderboard WHERE user_id = ?`,
        [userIdStr]
    );
    
    if (!result || result.length === 0) return null;
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const stats = {};
    columns.forEach((col, i) => { stats[col] = row[i]; });
    
    return stats;
}

function updateLeaderboard(userId, username, totalCount) {
    const userIdStr = String(userId);
    
    const existing = getUserCounterStats(userId);
    
    if (existing) {
        // UPDATE
        const stmt = db.prepare(
            `UPDATE counter_leaderboard SET total_count = ?, last_active = datetime('now')
             WHERE user_id = ?`
        );
        stmt.bind([totalCount, userIdStr]);
        stmt.step();
        stmt.free();
    } else {
        // INSERT
        const stmt = db.prepare(
            `INSERT INTO counter_leaderboard (user_id, total_count, last_active)
             VALUES (?, ?, datetime('now'))`
        );
        stmt.bind([userIdStr, totalCount]);
        stmt.step();
        stmt.free();
    }
    
    db.save();
}

function getTopCounters(limit = 10) {
    const result = db.exec(
        `SELECT * FROM counter_leaderboard ORDER BY total_count DESC LIMIT ?`,
        [limit]
    );
    
    if (!result || result.length === 0) return [];
    
    const columns = result[0].columns;
    return result[0].values.map(row => {
        const stats = {};
        columns.forEach((col, i) => { stats[col] = row[i]; });
        return stats;
    });
}

module.exports = {
    getUserCounterStats,
    updateLeaderboard,
    getTopCounters,
};