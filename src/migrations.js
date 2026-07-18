const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./database');

// Suche ticket_data.json im ROOT-Ordner
const ROOT_DIR = path.resolve(__dirname, '..');
const OLD_DATA_FILE = path.join(ROOT_DIR, 'ticket_data.json');

async function runMigration() {
    console.log('🔄 Starting migration from ticket_data.json...');
    console.log(`📂 Looking for: ${OLD_DATA_FILE}`);
    
    // Check if old file exists
    if (!fs.existsSync(OLD_DATA_FILE)) {
        console.log('❌ ticket_data.json not found!');
        console.log(`   Expected location: ${OLD_DATA_FILE}`);
        console.log('💡 Tip: Place ticket_data.json in the root folder.');
        return { migrated: 0 };
    }
    
    console.log('✅ Found ticket_data.json');
    
    // Read old data
    const rawData = fs.readFileSync(OLD_DATA_FILE, 'utf-8');
    const jsonData = JSON.parse(rawData);
    
    // Create backup
    const timestamp = Date.now();
    const backupFile = path.join(ROOT_DIR, `ticket_data_backup_${timestamp}.json`);
    fs.copyFileSync(OLD_DATA_FILE, backupFile);
    console.log(`💾 Backup created: ${backupFile}`);
    
    // Initialize database
    const dbInstance = db.init();
    console.log('✅ Database initialized');
    
    // Run migration
    const migrated = db.migrateFromJSON(jsonData);
    
    console.log(`✅ Successfully migrated ${migrated} tickets to SQLite!`);
    console.log('📊 Old file preserved:', OLD_DATA_FILE);
    
    return { migrated, backupFile };
}

if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('\n🎉 Migration complete!');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Migration failed:', err);
            process.exit(1);
        });
}

module.exports = { runMigration };