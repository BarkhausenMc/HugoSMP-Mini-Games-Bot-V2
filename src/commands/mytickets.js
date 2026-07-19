const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mytickets')
        .setDescription('Zeigt deine zugewiesenen Tickets und wie viele neu sind'),

    async execute(interaction, { config, db }) {
        // Staff check
        const hasStaff = config.STAFF_ROLE_ID && interaction.member.roles.cache.has(String(config.STAFF_ROLE_ID));
        const hasAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (!hasStaff && !hasAdmin) {
            await interaction.reply({ content: '❌ Nur Staff kann diesen Command nutzen!', flags: MessageFlags.Ephemeral });
            return;
        }

        const userId = String(interaction.user.id);
        const now = new Date().toISOString();

        // Alle offenen Tickets die diesem User zugewiesen sind
        const myTickets = db.getTicketsClaimedBy(userId);
        const totalCount = myTickets.length;

        // Letzter Check
        const lastSeen = db.getLastSeen(userId);

        // Neue Tickets seit letztem Check zählen
        let newCount = 0;
        let newTickets = [];

        if (lastSeen) {
            const lastSeenDate = new Date(lastSeen);
            newTickets = myTickets.filter(t => {
                // Ticket ist "neu" wenn created_at oder last_activity nach lastSeen ist
                const created = new Date(t.created_at);
                const activity = new Date(t.last_activity);
                return created > lastSeenDate || activity > lastSeenDate;
            });
            newCount = newTickets.length;
        } else {
            // Erster Check - alle sind "neu"
            newCount = totalCount;
            newTickets = [...myTickets];
        }

        // Embed bauen
        const embed = new EmbedBuilder()
            .setColor(0x6d4aff)
            .setTitle('📬 Meine zugewiesenen Tickets')
            .setTimestamp();

        if (totalCount === 0) {
            embed.setDescription(
                `**Aktuell zugewiesen:** 0\n**Neu seit letztem Check:** 0\n\n` +
                `🎉 Du hast keine offenen Tickets! Entspann dich!`
            );
            embed.setFooter({ text: `Zuletzt geprüft: ${lastSeen ? new Date(lastSeen).toLocaleString('de-DE') : 'Nie zuvor'}` });
        } else {
            // Status-Text bauen
            let statusText = `**Aktuell zugewiesen:** ${totalCount}\n`;
            
            if (lastSeen) {
                statusText += `**Neu seit letztem Check:** ${newCount}\n\n`;
            } else {
                statusText += `**Neu:** ${newCount} (Erster Check)\n\n`;
            }

            // Neue Tickets auflisten (max 10)
            if (newCount > 0) {
                statusText += `**🆕 Neue Tickets:**\n`;
                const displayNew = newTickets.slice(0, 10);
                for (const t of displayNew) {
                    const created = new Date(t.created_at).toLocaleString('de-DE');
                    statusText += `• <#${t.channel_id}> — **${t.category}** (${created})\n`;
                }
                if (newTickets.length > 10) {
                    statusText += `\n... und ${newTickets.length - 10} weitere!\n`;
                }
                statusText += '\n';
            }

            // Alle Tickets auflisten wenn Platz
            if (totalCount > newCount) {
                statusText += `**📋 Alle zugewiesenen Tickets:**\n`;
                const oldTickets = myTickets.filter(t => !newTickets.includes(t));
                const displayOld = oldTickets.slice(0, 10);
                for (const t of displayOld) {
                    const lastActivity = new Date(t.last_activity).toLocaleString('de-DE');
                    statusText += `• <#${t.channel_id}> — **${t.category}** (Letzte Aktivität: ${lastActivity})\n`;
                }
                if (oldTickets.length > 10) {
                    statusText += `\n... und ${oldTickets.length - 10} weitere!\n`;
                }
            }

            embed.setDescription(statusText);
            embed.setFooter({ 
                text: `Zuletzt geprüft: ${lastSeen ? new Date(lastSeen).toLocaleString('de-DE') : 'Nie zuvor'} • Jetzt aktualisiert!` 
            });
        }

        // Timestamp aktualisieren
        db.setLastSeen(userId, now);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};