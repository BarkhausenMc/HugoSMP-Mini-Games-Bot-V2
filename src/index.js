// src/index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const config = require('./config');
config.validate();

const db = require('./database');
const { logError, safeReply } = require('./utils/errorHandler');

// ==========================================
//   CLIENT KONFIGURATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // WICHTIG für Counter & Message Events
        GatewayIntentBits.GuildMembers,   // WICHTIG für Welcome Messages (guildMemberAdd)
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildEmojisAndStickers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selectMenus = new Collection();
client.events = new Collection(); // Für Events speichern

// ==========================================
//   LOADER
// ==========================================
function loadHandlers() {
    const dirs = [
        { dir: path.join(__dirname, 'commands'), collection: client.commands, type: 'command' },
        { dir: path.join(__dirname, 'interactions', 'buttons'), collection: client.buttons, type: 'button' },
        { dir: path.join(__dirname, 'interactions', 'modals'), collection: client.modals, type: 'modal' },
        { dir: path.join(__dirname, 'interactions', 'selectMenus'), collection: client.selectMenus, type: 'selectMenu' },
        { dir: path.join(__dirname, 'events'), collection: client.events, type: 'event' },
    ];

    for (const { dir, collection, type } of dirs) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        
        for (const file of files) {
            try {
                const filePath = path.join(dir, file);
                const handler = require(filePath);
                
                if (type === 'event') {
                    // Event laden
                    if (handler.name && typeof handler.execute === 'function') {
                        // Wir registrieren das Event direkt am Client
                        // Wichtig: Wir fangen Fehler ab, damit ein Event-Crash den ganzen Bot nicht killt
                        client.on(handler.name, async (...args) => {
                            try {
                                // Argumente anpassen: Event-Handler brauchen oft (arg1, arg2, context)
                                // Unsere Events erwarten: (message, client) + { client, config, db }
                                // Wir bauen das Context-Objekt zusammen
                                const context = { client, config, db };
                                
                                // Falls es ein Interaction-Event ist (z.B. interactionCreate), wird das anders gehandhabt
                                // Aber für guildMemberAdd oder messageCreate:
                                if (handler.name === 'guildMemberAdd') {
                                    // args[0] = member, args[1] = client (wird ignoriert, da wir client aus closure haben)
                                    await handler.execute(args[0], client, context);
                                } else if (handler.name === 'messageCreate') {
                                    // args[0] = message
                                    await handler.execute(args[0], client, context);
                                } else if (handler.name === 'ready') {
                                    // ready wird separat geladen, aber falls hier:
                                    await handler.execute(client, context);
                                } else {
                                    // Fallback für andere Events
                                    await handler.execute(...args, context);
                                }
                            } catch (err) {
                                console.error(`❌ Event Error [${handler.name}]:`, err.message);
                                console.error(err.stack);
                            }
                        });
                        console.log(`✅ Geladen Event: ${file}`);
                    } else {
                        console.warn(`⚠️ Skipped invalid event: ${file} (missing name or execute)`);
                    }
                } else {
                    // Commands, Buttons, Modals, SelectMenus
                    const id = file.replace('.js', '');
                    collection.set(id, handler);
                    console.log(`✅ Geladen ${type}: ${file}`);
                }
            } catch (err) {
                console.error(`❌ Failed to load ${file}:`, err.message);
                console.error(err.stack);
            }
        }
    }
}

// ==========================================
//   INTERACTION DISPATCHER (Slash Commands, Buttons, etc.)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;

    try {
        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction, { client, config, db });
            return;
        }

        // --- SELECT MENUS ---
        if (interaction.isStringSelectMenu()) {
            const handler = client.selectMenus.get(interaction.customId);
            if (!handler) return;
            await handler.execute(interaction, { client, config, db });
            return;
        }

        // --- MODALS ---
        if (interaction.isModalSubmit()) {
            let handler = client.modals.get(interaction.customId);
            if (!handler) {
                for (const [key, val] of client.modals) {
                    if (interaction.customId.startsWith(key)) {
                        handler = val;
                        break;
                    }
                }
            }
            if (!handler) return;
            await handler.execute(interaction, { client, config, db });
            return;
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            let handler = client.buttons.get(interaction.customId);
            if (!handler) {
                for (const [key, val] of client.buttons) {
                    if (interaction.customId.startsWith(key)) {
                        handler = val;
                        break;
                    }
                }
            }
            if (!handler) return;
            await handler.execute(interaction, { client, config, db });
            return;
        }
    } catch (err) {
        // Globaler Error Handler für Interactions
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ❌ Interaction Error:`);
        console.error(`   User: ${interaction.user?.tag || 'Unknown'}`);
        console.error(`   Type: ${interaction.type}`);
        console.error(`   ID: ${interaction.commandName || interaction.customId || 'Unknown'}`);
        console.error(`   Error: ${err.message}`);
        
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Ein Fehler ist aufgetreten!' }).catch(() => {});
            } else {
                await interaction.reply({ content: '❌ Ein Fehler ist aufgetreten!', flags: 64 }).catch(() => {});
            }
        } catch (replyErr) {
            console.error('Failed to send error reply:', replyErr.message);
        }
    }
});

// ==========================================
//   READY EVENT (Separat laden, da es oft anders strukturiert ist)
// ==========================================
// Wir laden ready.js manuell, da es oft keine "execute" Funktion hat, sondern direkt läuft
try {
    const readyHandler = require('./events/ready');
    if (typeof readyHandler === 'function') {
        client.once('ready', (c) => readyHandler(c, { client, config, db }));
    } else if (readyHandler && readyHandler.execute) {
        client.once('ready', (c) => readyHandler.execute(c, { client, config, db }));
    }
    console.log('✅ Ready Event geladen.');
} catch (err) {
    console.error('❌ Konnte Ready Event nicht laden:', err.message);
}

// ==========================================
//   GRACEFUL SHUTDOWN
// ==========================================
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down...');
    db.close();
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    // Optional: Bot nicht beenden, nur loggen
});

// ==========================================
//   START
// ==========================================
async function main() {
    console.log('🚀 Starting HugoSMP Mini-Games Bot V2...');
    loadHandlers();
    
    // Login
    try {
        await client.login(config.DISCORD_TOKEN);
        console.log('✅ Bot erfolgreich eingeloggt!');
    } catch (err) {
        console.error('❌ Login fehlgeschlagen:', err.message);
        process.exit(1);
    }
}

main().catch(console.error);