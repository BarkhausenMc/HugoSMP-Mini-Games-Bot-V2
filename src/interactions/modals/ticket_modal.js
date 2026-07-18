const { EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

function buildTicketActionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claimen')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('ticket_notes')
            .setLabel('Note schreiben')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝'),
        new ButtonBuilder()
            .setCustomId('ticket_show_notes')
            .setLabel('Notes anzeigen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍'),
        new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Schließen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );
}

module.exports = {
    execute: async (interaction, { client, config, db }) => {
        try {
            const categoryKey = interaction.customId.replace('ticket_modal_', '');
            const cat = config.TICKET_CATEGORIES[categoryKey];
            const userId = String(interaction.user.id);

            // Rate limit check
            const allTickets = db.getAllTickets();
            const activeCount = allTickets.filter(t => t.owner_id === userId && !t.closed).length;
            if (activeCount >= config.MAX_ACTIVE_TICKETS_PER_USER) {
                await interaction.reply({ content: `❌ Du hast bereits ${activeCount} aktive(s) Ticket(s)! Bitte warte bis es geschlossen ist.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const guild = interaction.guild;
            const username = interaction.user.username;
            const channelName = `${cat.prefix}-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100);

            // Find or create category
            let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === config.TICKET_CATEGORY_NAME);
            if (!category) {
                category = await guild.channels.create({ name: config.TICKET_CATEGORY_NAME, type: ChannelType.GuildCategory });
            }

            // Permissions
            const overwrites = [
                { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
            ];

            // Staff perms for non-Bug-Report categories
            if (config.STAFF_ROLE_ID && categoryKey !== 'Bug Report') {
                const staffRole = guild.roles.cache.get(config.STAFF_ROLE_ID);
                if (staffRole) {
                    overwrites.push({
                        id: staffRole,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions]
                    });
                }
            }

            // Create channel
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: overwrites,
                topic: `Ticket | ${categoryKey} | Owner: ${username} | Claim: None`,
            });

            // Special perms for Bug Report
            if (categoryKey === 'Bug Report' && config.OWNER_ROLE_ID) {
                const ownerRole = guild.roles.cache.get(config.OWNER_ROLE_ID);
                if (ownerRole) {
                    await ticketChannel.permissionOverwrites.edit(ownerRole, {
                        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
                    });
                }
            } else if (cat.allowedRoles && categoryKey !== 'Bug Report') {
                for (const roleId of cat.allowedRoles) {
                    const role = guild.roles.cache.get(roleId);
                    if (role) {
                        await ticketChannel.permissionOverwrites.edit(role, {
                            ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
                        });
                    }
                }
            }

            // Build embed
            const embed = new EmbedBuilder()
                .setTitle(`${cat.emoji || '🎫'} Ticket: ${categoryKey}`)
                .setColor(0x6d4aff)
                .setTimestamp()
                .addFields(
                    { name: '👤 Erstellt von', value: interaction.user.toString(), inline: true },
                    { name: '📂 Kategorie', value: categoryKey, inline: true },
                    { name: '🏷️ Ticket ID', value: String(ticketChannel.id), inline: true }
                );

            cat.questions.forEach((q, index) => {
                const answer = interaction.fields.getTextInputValue(`question_${index}`) || 'Nicht angegeben';
                embed.addFields({ name: q.label, value: answer, inline: false });
            });

            embed.setFooter({ text: 'HugoSMP Mini-Games | Klicke unten um zu schließen 🔒' });

            // ⭐ SENDING EMBED + BUTTONS ⭐
            const msg = await ticketChannel.send({ embeds: [embed], components: [buildTicketActionRow()] });

            // ⭐ PING NUR JE NACH KATEGORIE ⭐
            if (categoryKey === 'Bug Report') {
                await ticketChannel.send(`${interaction.user} Dein Ticket ist offen! <@&${config.OWNER_ROLE_ID}>`);
            } else {
                await ticketChannel.send(`${interaction.user} Dein Ticket ist offen! Ein Teammitglied meldet sich bald. ✅ <@&${config.STAFF_ROLE_ID}>`);
            }

            // Save to DB
            db.createTicket({
                channelId: ticketChannel.id,
                ownerId: userId,
                category: categoryKey,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                claimedBy: null,
                closed: 0,
                closedAt: null,
                rating: null,
                locked: 0,
                lockReason: null,
                lockBy: null,
                lockedAt: null,
                messageId: msg.id,
            });

            await interaction.reply({ content: `✅ Ticket erstellt: ${ticketChannel.toString()}`, flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Ticket Creation Error:', error.message);
            console.error(error.stack); // ⭐ DEBUG STACK TRACE! ⭐
            await interaction.reply({ content: '❌ Fehler beim Erstellen des Tickets! Siehe Console für Details.', flags: MessageFlags.Ephemeral });
        }
    },
};

