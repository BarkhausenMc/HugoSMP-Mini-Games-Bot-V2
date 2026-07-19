// require('dotenv').config();
// const { REST, Routes } = require('discord.js');
// const fs = require('fs');
// const path = require('path');
// const config = require('./config');

// const commands = [];
// const commandsDir = path.join(__dirname, 'commands');

// console.log(`📂 Scanning directory: ${commandsDir}`);

// if (!fs.existsSync(commandsDir)) {
//     console.error(`❌ Commands directory not found: ${commandsDir}`);
//     process.exit(1);
// }

// for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
//     try {
//         const fullPath = path.join(commandsDir, file);
//         const cmd = require(fullPath);
        
//         if (cmd.data) {
//             const commandData = cmd.data.toJSON ? cmd.data.toJSON() : cmd.data;
//             commands.push(commandData);
//             console.log(`📋 Loaded command: ${file} → /${commandData.name}`);
//         } else {
//             console.warn(`⚠️ ${file} has no data export, skipping...`);
//         }
//     } catch (err) {
//         console.error(`❌ Failed to load ${file}:`, err.message);
//     }
// }

// const token = config.DISCORD_TOKEN;

// // ⭐ FIXED: Client ID muss numerisch sein! ⭐
// let clientId = config.CLIENT_ID;

// if (!clientId) {
//     // Versuche numerischen ID aus Token zu extrahieren (funktioniert selten, aber Versuch wert)
//     console.error('⚠️ CLIENT_ID fehlt in .env!');
//     console.error('🔗 Bitte Discord Developer Portal nutzen: https://discord.com/developers/applications');
//     console.error('ℹ️ Alternativ: Füge CLIENT_ID=NUMMERISCHE_ID in .env ein');
//     process.exit(1);  // Exit damit du den Fehler siehst!
// }

// if (!/^\d+$/.test(clientId)) {
//     console.error('❌ CLIENT_ID muss numerisch sein!');
//     console.error('📋 Aktueller Wert:', clientId);
//     console.error('🔗 Discord Developer Portal: https://discord.com/developers/applications');
//     process.exit(1);
// }

// console.log(`\n🎯 Client ID: ${clientId}`);

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ⭐ HARDCODED FÜR TESTEN! ⭐
const clientId = '1527370161403990148';  // ← VON DEV PORTAL!
const serverId = '1507660263585747034';
const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error('❌ DISCORD_TOKEN fehlt in .env!');
    process.exit(1);
}

const commands = [];
const commandsDir = path.join(__dirname, 'commands');

console.log(`📂 Scanning directory: ${commandsDir}`);

if (!fs.existsSync(commandsDir)) {
    console.error(`❌ Commands directory not found: ${commandsDir}`);
    process.exit(1);
}

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    try {
        const fullPath = path.join(commandsDir, file);
        const cmd = require(fullPath);
        
        if (cmd.data) {
            const commandData = cmd.data.toJSON ? cmd.data.toJSON() : cmd.data;
            commands.push(commandData);
            console.log(`📋 Loaded command: ${file} → /${commandData.name}`);
        } else {
            console.warn(`⚠️ ${file} has no data export, skipping...`);
        }
    } catch (err) {
        console.error(`❌ Failed to load ${file}:`, err.message);
    }
}

console.log(`\n🎯 Client ID: ${clientId}`);
console.log(`🎯 Server ID: ${serverId}`);
console.log(`📊 Total commands: ${commands.length}`);

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`\n🚀 Started deploying ${commands.length} slash commands...`);

        await rest.put(
            Routes.applicationGuildCommands(clientId, serverId),
            { body: commands },
        );

        console.log('\n✅ Successfully deployed slash commands!');
    } catch (err) {
        console.error('❌ Deploy failed:', err.rawError?.message || err.message);
        if (err.rawError?.errors) {
            console.error(JSON.stringify(err.rawError.errors, null, 2));
        }
    }
})();