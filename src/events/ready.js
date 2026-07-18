const config = require('../config');
const db = require('../database');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async (client) => {
        console.log(`✅ Bot online als ${client.user.tag}`);

        // Initialize database
        try {
            await db.init();
            console.log('✅ Database initialized');
        } catch (err) {
            console.error('❌ Database initialization failed:', err.message);
            process.exit(1);
        }

        // Auto-migrate old JSON if exists
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, '..', '..', 'ticket_data.json');
        if (fs.existsSync(migrationPath)) {
            console.log('📦 Found ticket_data.json - starting migration...');
            try {
                const jsonData = JSON.parse(fs.readFileSync(migrationPath, 'utf-8'));
                const migrated = db.migrateFromJSON(jsonData);
                console.log(`✅ Migrated ${migrated} tickets from old format`);

                const backupPath = migrationPath.replace('.json', `_backup_${Date.now()}.json`);
                fs.copyFileSync(migrationPath, backupPath);
                console.log(`💾 Backup created: ${backupPath}`);
            } catch (err) {
                console.error('❌ Migration failed:', err.message);
            }
        }

        // Register commands
        try {
            const commands = [];
            for (const [, cmd] of client.commands) {
                if (cmd.data) {
                    commands.push(cmd.data.toJSON ? cmd.data.toJSON() : cmd.data);
                }
            }

            const guild = client.guilds.cache.get(config.SERVER_ID);
            if (guild && commands.length > 0) {
                await guild.commands.set(commands);
                console.log('✅ Guild commands registered');
            }
        } catch (err) {
            console.error('⚠️ Command registration failed:', err.message);
        }

        // ⭐ AUTO-CLOSE SCHEDULER (ersetzt while(true)) ⭐
        const AUTO_CLOSE_INTERVAL = 60 * 60 * 1000; // 1 hour
        const autoCloseTimer = setInterval(async () => {
            try {
                const tickets = db.getOpenTickets();
                const cutoff = new Date(Date.now() - config.INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

                for (const ticket of tickets) {
                    if (ticket.closed) continue;

                    const lastActivity = new Date(ticket.last_activity);
                    if (lastActivity < cutoff) {
                        const guild = client.guilds.cache.get(config.SERVER_ID);
                        if (!guild) continue;

                        const channel = guild.channels.cache.get(ticket.channel_id);
                        if (!channel) continue;

                        try {
                            await channel.send('⚠️ **AUTO-CLOSE WARNUNG**\nDieses Ticket wird in 24h automatisch geschlossen wegen Inaktivität!');
                        } catch (err) {
                            console.error(`Failed to send warning to ${ticket.channel_id}:`, err.message);
                        }

                        // Wait 24h then check again
                        setTimeout(async () => {
                            try {
                                const freshTicket = db.getTicket(ticket.channel_id);
                                if (freshTicket && !freshTicket.closed) {
                                    const freshLastActivity = new Date(freshTicket.last_activity);
                                    if (freshLastActivity < cutoff) {
                                        db.updateTicket(ticket.channel_id, {
                                            closed: 1,
                                            closed_at: new Date().toISOString(),
                                        });

                                        try {
                                            await channel.send('🔒 **Automatisch geschlossen** wegen Inaktivität.');
                                            await new Promise(r => setTimeout(r, 2000));
                                            await channel.delete();
                                            db.deleteTicket(ticket.channel_id);
                                        } catch (err) {
                                            console.error('Auto-close delete failed:', err.message);
                                        }

                                        if (config.LOG_CHANNEL_ID) {
                                            const logChannel = guild.channels.cache.get(config.LOG_CHANNEL_ID);
                                            if (logChannel) {
                                                const logEmbed = new EmbedBuilder()
                                                    .setTitle('🔁 Auto-Closed Ticket')
                                                    .setColor(0xe67e22)
                                                    .setTimestamp()
                                                    .addFields(
                                                        { name: 'Channel', value: channel.name, inline: true },
                                                        { name: 'Inaktiv seit', value: `${config.INACTIVITY_DAYS} Tagen`, inline: false }
                                                    );
                                                await logChannel.send({ embeds: [logEmbed] });
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error('Auto-close secondary check failed:', err.message);
                            }
                        }, 24 * 60 * 60 * 1000); // 24h delay
                    }
                }
            } catch (err) {
                console.error('Auto-close scheduler error:', err.message);
            }
        }, AUTO_CLOSE_INTERVAL);

        // Store timer for cleanup
        client.autoCloseTimer = autoCloseTimer;

        console.log('✅ Auto-close scheduler started (hourly interval)');
        console.log(`🌐 Connected to guild: ${config.SERVER_ID}`);
    });
};