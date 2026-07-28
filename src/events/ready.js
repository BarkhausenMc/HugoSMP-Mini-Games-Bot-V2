// src/events/ready.js
const config = require('../config');
const db = require('../database');
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log('========================================');
        console.log(`✅ Bot ist online als ${client.user.tag}!`);
        console.log(`🌐 Verbunden mit ${client.guilds.cache.size} Servern.`);
        console.log(`⏰ Zeit: ${new Date().toLocaleString('de-DE')}`);
        console.log('========================================');

        // 1. Bot Status setzen
        client.user.setActivity('Mini-Games | /counterstart', { type: 'WATCHING' });

        // 2. Datenbank initialisieren
        try {
            await db.init();
            console.log('✅ Database initialized');
        } catch (err) {
            console.error('❌ Database initialization failed:', err.message);
            process.exit(1);
        }

        // 3. Auto-Migration (falls alte JSON existiert)
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

        // 4. Slash Commands registrieren
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

        // 5. ⭐ AUTO-CLOSE SCHEDULER ⭐
        const AUTO_CLOSE_INTERVAL = 60 * 60 * 1000;
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
                        }, 24 * 60 * 60 * 1000);
                    }
                }
            } catch (err) {
                console.error('Auto-close scheduler error:', err.message);
            }
        }, AUTO_CLOSE_INTERVAL);

        client.autoCloseTimer = autoCloseTimer;
        console.log('✅ Auto-close scheduler started (hourly interval)');
        console.log(`🌐 Connected to guild: ${config.SERVER_ID}`);

        // 6. ⭐ GIVEAWAY SCHEDULER ⭐
        const giveawayTimer = setInterval(async () => {
            try {
                const activeGiveaways = db.getActiveGiveaways();

                for (const giveaway of activeGiveaways) {
                    try {
                        const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
                        if (!channel) {
                            console.log(`⚠️ Giveaway ${giveaway.id}: Channel nicht gefunden — wird als beendet markiert`);
                            db.endGiveaway(giveaway.id);
                            continue;
                        }

                        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
                        if (!message) {
                            console.log(`⚠️ Giveaway ${giveaway.id}: Nachricht nicht gefunden — wird als beendet markiert`);
                            db.endGiveaway(giveaway.id);
                            continue;
                        }

                        const entries = db.getGiveawayEntries(giveaway.id);

                        let winners = [];
                        if (entries.length > 0) {
                            const shuffled = [...entries].sort(() => Math.random() - 0.5);
                            const winnerCount = Math.min(giveaway.winner_count, entries.length);
                            winners = shuffled.slice(0, winnerCount);
                        }

                        db.saveGiveawayWinners(giveaway.id, winners);
                        db.endGiveaway(giveaway.id);

                        const winnerMentions = winners.length > 0
                            ? winners.map(id => `<@${id}>`).join(', ')
                            : null;

                        const finalDescription =
                            `> ${giveaway.description}\n\n` +
                            `👥 **Gewinner:** ${giveaway.winner_count}\n` +
                            `⏰ **Status:** Bereits Geendet ✅\n` +
                            `🎟️ **Teilnehmer:** ${entries.length}\n` +
                            `👑 **Host:** <@${giveaway.host_id}>\n\n` +
                            (winners.length > 0
                                ? `🎊 **GEWINNER:** ${winnerMentions} 🎉\n\n🎁 Klicke auf "Gewinn abholen" um deinen Gewinn zu claimen!`
                                : `😔 **Keine Gewinner** — keine Teilnehmer!`);

                        const embed = EmbedBuilder.from(message.embeds[0])
                            .setDescription(finalDescription)
                            .setColor(winners.length > 0 ? 0x00ff00 : 0xff0000)
                            .setFooter({ text: `Giveaway beendet • ID: ${giveaway.id}` });

                        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                        let components = [];
                        if (winners.length > 0) {
                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`giveaway_claim_${giveaway.id}`)
                                    .setLabel('🎁 Gewinn abholen')
                                    .setStyle(ButtonStyle.Success)
                            );
                            components = [row];
                        }

                        await message.edit({ embeds: [embed], components });

                        if (winners.length > 0) {
                            await channel.send({
                                content: `🎊 **Giveaway beendet!**\nHerzlichen Glückwunsch an ${winnerMentions}!\n🎉${giveaway.title}**`,
                                allowedMentions: { users: winners }
                            });
                        } else {
                            await channel.send(`😔 **Giveaway "${giveaway.title}"** wurde beendet — leider gab es keine Teilnehmer.`);
                        }

                    } catch (error) {
                        console.error(`Fehler beim Beenden des Giveaways ${giveaway.id}:`, error.message);
                        db.endGiveaway(giveaway.id);
                    }
                }
            } catch (err) {
                console.error('Giveaway scheduler error:', err.message);
            }
        }, 30_000);

        client.giveawayTimer = giveawayTimer;
        console.log('✅ Giveaway scheduler started (30s interval)');

        // 7. ⭐ REROLL SCHEDULER ⭐
        const rerollTimer = setInterval(async () => {
            try {
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                
                // Alle beendeten Giveaways prüfen
                const allEnded = db.exec(`SELECT * FROM giveaways WHERE ended = 1 OR ended = 2`);
                
                if (!allEnded || allEnded.length === 0 || allEnded[0].values.length === 0) return;
                
                const columns = allEnded[0].columns;
                const endedGiveaways = allEnded[0].values.map(row => {
                    const g = {};
                    columns.forEach((col, i) => { g[col] = row[i]; });
                    return g;
                });

                for (const giveaway of endedGiveaways) {
                    try {
                        let referenceTime = giveaway.end_time * 1000;
                        
                        // Prüfen ob es einen letzten Reroll gibt (falls die Funktion existiert)
                        // Falls db.getLastRerollTime nicht existiert, überspringen wir diesen Teil oder nutzen fallback
                        if (db.getLastRerollTime) {
                            const lastReroll = db.getLastRerollTime(giveaway.id);
                            if (lastReroll) {
                                referenceTime = new Date(lastReroll).getTime();
                            }
                        }
                        
                        const now = Date.now();
                        if (now - referenceTime < 24 * 60 * 60 * 1000) continue;
                        
                        const winners = db.getGiveawayWinners(giveaway.id);
                        const claims = db.getGiveawayClaimDetails(giveaway.id);
                        
                        const unclaimedWinners = winners.filter(winner => 
                            !claims.some(c => String(c.user_id) === winner)
                        );
                        
                        if (unclaimedWinners.length === 0) continue;
                        
                        const guild = client.guilds.cache.get(giveaway.guild_id);
                        if (!guild) continue;
                        
                        const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
                        if (!channel) continue;
                        
                        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
                        if (!message) continue;
                        
                        const remainingEntries = db.getGiveawayEntries(giveaway.id);
                        const eligibleUsers = remainingEntries.filter(user => 
                            !winners.includes(user)
                        );
                        
                        if (eligibleUsers.length === 0) {
                            console.log(`⚠️ Giveaway ${giveaway.id}: Keine weiteren Teilnehmer für Reroll!`);
                            if (db.run) db.run(`UPDATE giveaways SET ended = 3 WHERE id = ?`, [giveaway.id]);
                            continue;
                        }
                        
                        const shuffled = [...eligibleUsers].sort(() => Math.random() - 0.5);
                        const newWinners = shuffled.slice(0, unclaimedWinners.length);
                        
                        for (const oldWinner of unclaimedWinners) {
                            if (db.recordReroll) db.recordReroll(giveaway.id, oldWinner, null);
                        }
                        
                        const claimedWinners = winners.filter(winner => 
                            claims.some(c => String(c.user_id) === winner)
                        );
                        const allFinalWinners = [...claimedWinners, ...newWinners];
                        db.saveGiveawayWinners(giveaway.id, allFinalWinners);
                        
                        if (db.markGiveawayRerolled) db.markGiveawayRerolled(giveaway.id);
                        
                        const winnerMentions = allFinalWinners.map(id => `<@${id}>`).join(', ');
                        
                        const embed = EmbedBuilder.from(message.embeds[0]);
                        
                        const descLines = embed.data.description.split('\n').map(line => {
                            if (line.startsWith('🎊')) {
                                return `🎊 **GEWINNER:** ${winnerMentions}`;
                            }
                            if (line.startsWith('⏰')) {
                                return '⏰ **Status:** ABGELAUFEN (REROLLED)';
                            }
                            return line;
                        }).join('\n');
                        
                        embed.setDescription(descLines)
                            .setColor(0xffa500)
                            .setFooter({ text: `Giveaway gererollt • ID: ${giveaway.id}` });
                        
                        const claimRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`giveaway_claim_${giveaway.id}`)
                                .setLabel('🎁 Gewinn abholen')
                                .setStyle(ButtonStyle.Success)
                        );
                        
                        await message.edit({ embeds: [embed], components: [claimRow] });
                        
                        await channel.send({
                            content: `🔄 **Giveaway gererollt!**\nDie vorherigen Gewinner haben sich nicht innerhalb von 24h gemeldet.\n\n**Neue Gewinner:** ${newWinners.map(id => `<@${id}>`).join(', ')}\n🎉 **${giveaway.title}**\n\nKlicke auf **"🎁 Gewinn abholen"** um deinen Gewinn zu claimen!`,
                            allowedMentions: { users: newWinners }
                        });
                        
                        if (config.GIVEAWAY_CLAIM_LOG_CHANNEL_ID) {
                            const logChannel = guild.channels.cache.get(config.GIVEAWAY_CLAIM_LOG_CHANNEL_ID);
                            if (logChannel) {
                                const logEmbed = new EmbedBuilder()
                                    .setTitle('🔄 Giveaway Reroll')
                                    .setColor(0xffa500)
                                    .setDescription(
                                        `**Giveaway:** ${giveaway.title}\n` +
                                        `**Alte Gewinner (nicht geclaimed):** ${unclaimedWinners.map(id => `<@${id}>`).join(', ')}\n` +
                                        `**Neue Gewinner:** ${newWinners.map(id => `<@${id}>`).join(', ')}\n` +
                                        `**Zeit:** ${new Date().toLocaleString('de-DE')}`
                                    )
                                    .setTimestamp();
                                
                                await logChannel.send({ embeds: [logEmbed] });
                            }
                        }
                        
                        console.log(`✅ Reroll completed for giveaway ${giveaway.id}`);
                        
                    } catch (error) {
                        console.error(`Fehler beim Reroll des Giveaways ${giveaway.id}:`, error.message);
                    }
                }
            } catch (err) {
                console.error('Reroll scheduler error:', err.message);
            }
        }, 60 * 60 * 1000);
        
        client.rerollTimer = rerollTimer;
        console.log('✅ Reroll scheduler started (1h interval, 24h wait)');
    }
};