require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const config = require('./config');
config.validate();

const db = require('./database');
const { logError, safeReply } = require('./utils/errorHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selectMenus = new Collection();

// ==========================================
//   LOADER
// ==========================================
function loadHandlers() {
    const dirs = [
        { dir: path.join(__dirname, 'commands'), collection: client.commands, type: 'command' },
        { dir: path.join(__dirname, 'interactions', 'buttons'), collection: client.buttons, type: 'button' },
        { dir: path.join(__dirname, 'interactions', 'modals'), collection: client.modals, type: 'modal' },
        { dir: path.join(__dirname, 'interactions', 'selectMenus'), collection: client.selectMenus, type: 'selectMenu' },
    ];

    for (const { dir, collection, type } of dirs) {
        if (!fs.existsSync(dir)) continue;

        for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
            try {
                const handler = require(path.join(dir, file));
                const id = file.replace('.js', '');
                collection.set(id, handler);
                console.log(`✅ Loaded ${file}`);
            } catch (err) {
                console.error(`❌ Failed to load ${file}:`, err.message);
            }
        }
    }
}

// ==========================================
//   INTERACTION DISPATCHER
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
            // Exact match first
            let handler = client.modals.get(interaction.customId);

            // Prefix match for dynamic modals (ticket_modal_*)
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
            // Exact match first
            let handler = client.buttons.get(interaction.customId);

            // Prefix match for dynamic buttons (in_ticket_rating_*)
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
        // ⭐ INLINE ERROR HANDLING FALLS MODUL FEHLT ⭐
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ❌ ERROR:`);
        console.error(`   User: ${interaction.user?.tag || 'Unknown'}`);
        console.error(`   Command/Button: ${interaction.commandName || interaction.customId || 'Unknown'}`);
        console.error(`   Error: ${err.message}`);
        console.error(`   Stack: ${err.stack}`);

        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Ein unerwarteter Fehler ist aufgetreten!' });
            } else if (interaction.replied) {
                await interaction.followUp({ content: '❌ Ein unerwarteter Fehler ist aufgetreten!', flags: 64 });
            } else {
                await interaction.reply({ content: '❌ Ein unerwarteter Fehler ist aufgetreten!', flags: 64 });
            }
        } catch (replyErr) {
            console.error('Failed to send error reply:', replyErr.message);
        }
    }
});

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

process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
});

// ==========================================
//   START
// ==========================================
async function main() {
    loadHandlers();
    require('./events/ready')(client);
    client.login(config.DISCORD_TOKEN);
}

main().catch(console.error);