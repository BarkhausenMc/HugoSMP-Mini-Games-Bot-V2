require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const commands = [];
const commandsDir = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    try {
        const cmd = require(path.join(commandsDir, file));
        if (cmd.data) {
            commands.push(cmd.data.toJSON ? cmd.data.toJSON() : cmd.data);
            console.log(`📋 Loaded command: ${file}`);
        }
    } catch (err) {
        console.error(`❌ Failed to load ${file}:`, err.message);
    }
}

// ⭐ FIX: Token richtig parsen ⭐
const token = config.DISCORD_TOKEN;
const clientId = config.DISCORD_TOKEN.split('.')[0];

// ⭐ ODER: Direkt Application ID aus ENV verwenden falls vorhanden ⭐
// const clientId = process.env.CLIENT_ID || config.DISCORD_TOKEN.split('.')[0];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Started deploying ${commands.length} slash commands...`);

        await rest.put(
            Routes.applicationGuildCommands(clientId, config.SERVER_ID),
            { body: commands },
        );

        console.log('✅ Successfully deployed slash commands!');
    } catch (err) {
        console.error('❌ Deploy failed:', err.rawError?.message || err.message);
    }
})();