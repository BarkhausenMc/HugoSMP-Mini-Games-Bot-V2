const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketreopen')
        .setDescription('Öffnet ein geschlossenes Ticket wieder')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('channel_id').setDescription('Channel ID des Tickets').setRequired(true)
        )
        .addUserOption(option =>
            option.setName('owner').setDescription('Owner des Tickets (falls anders)').setRequired(false)
        ),

    execute: async (interaction, { config, db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = interaction.options.getString('channel_id');
        const ownerUser = interaction.options.getUser('owner');
        const channel = interaction.guild.channels.cache.get(channelId);
        const ticket = db.getTicket(channelId);

        if (!channel) {
            await interaction.reply({ content: '❌ Channel nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }
        if (!ticket) {
            await interaction.reply({ content: '❌ Ticket-Daten nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }
        if (!ticket.closed) {
            await interaction.reply({ content: '⚠️ Ticket ist bereits offen!', flags: MessageFlags.Ephemeral });
            return;
        }

        const updates = {
            closed: 0,
            closed_at: null,
            rating: null,
            last_activity: new Date().toISOString(),
        };

        if (ownerUser) {
            updates.owner_id = ownerUser.id;
        }

        db.updateTicket(channelId, updates);

        const ownerId = ownerUser ? ownerUser.id : ticket.owner_id;

        if (ownerId) {
            try {
                await channel.permissionOverwrites.edit(ownerId, {
                    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
                });
            } catch (err) {
                console.error('Reopen permission error:', err.message);
            }
        }

        const reopenEmbed = new EmbedBuilder()
            .setTitle('↩️ Ticket wieder geöffnet')
            .setDescription(`Dieses Ticket wurde wieder geöffnet.\n\n**Öffnet von:** ${interaction.user}\n**Owner:** <@${ownerId}>\n\nDiskussion kann fortgesetzt werden! ✅`)
            .setColor(0x57f287)
            .setTimestamp();

        await channel.send({ embeds: [reopenEmbed] });

        // ⭐ BUTTONS ZURÜCKSETZEN! ⭐
        try {
            const originalMsg = await channel.messages.fetch(ticket.message_id);
            if (originalMsg) {
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claimen').setStyle(ButtonStyle.Primary).setEmoji('📋'),
                    new ButtonBuilder().setCustomId('ticket_notes').setLabel('Note schreiben').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId('ticket_show_notes').setLabel('Notes anzeigen').setStyle(ButtonStyle.Secondary).setEmoji('🔍'),
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('Schließen').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );
                await originalMsg.edit({ components: [actionRow] });
            }
        } catch (err) {
            console.error('Failed to restore buttons:', err.message);
        }

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('↩️ Ticket wieder geöffnet')
                    .setColor(0x57f287)
                    .setTimestamp()
                    .addFields(
                        { name: 'Channel', value: channel.name, inline: true },
                        { name: 'Owner', value: `<@${ownerId}>`, inline: true },
                        { name: 'Durch', value: interaction.user.toString(), inline: true }
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }
        }

        await interaction.reply({ content: '✅ Ticket wurde wieder geöffnet!', flags: MessageFlags.Ephemeral });
    },
};