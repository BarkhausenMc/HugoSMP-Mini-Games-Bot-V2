const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketunlock')
        .setDescription('Öffnet das Ticket wieder für den User')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('channel_id').setDescription('Channel ID des Tickets (optional)').setRequired(false)
        ),

    execute: async (interaction, { config, db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = interaction.options.getString('channel_id');
        const targetChannelId = channelId || String(interaction.channel.id);
        const channel = interaction.guild.channels.cache.get(targetChannelId);
        const ticket = db.getTicket(targetChannelId);

        if (!channel) {
            await interaction.reply({ content: '❌ Channel nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }
        if (!ticket) {
            await interaction.reply({ content: '❌ Ticket nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }
        if (!ticket.locked) {
            await interaction.reply({ content: '⚠️ Ticket ist bereits entsperrt oder wurde nie gesperrt!', flags: MessageFlags.Ephemeral });
            return;
        }

        db.updateTicket(targetChannelId, {
            locked: 0,
            lock_reason: null,
            lock_by: null,
            lock_at: null,
            last_activity: new Date().toISOString(),
        });

        if (ticket.owner_id) {
            try {
                await channel.permissionOverwrites.edit(ticket.owner_id, {
                    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
                });
            } catch (err) {
                console.error('Unlock permission error:', err.message);
            }
        }

        const unlockEmbed = new EmbedBuilder()
            .setTitle('🔓 Ticket entsperrt')
            .setDescription(`Dieses Ticket wurde wieder freigegeben.\n\n**Entsperrt von:** ${interaction.user}\n\nDer User kann wieder Nachrichten senden! ✅`)
            .setColor(0x57f287)
            .setTimestamp();

        await channel.send({ embeds: [unlockEmbed] });

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔓 Ticket entsperrt')
                    .setColor(0x57f287)
                    .setTimestamp()
                    .addFields(
                        { name: 'Channel', value: channel.name, inline: true },
                        { name: 'Durch', value: interaction.user.toString(), inline: true }
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }
        }

        await interaction.reply({ content: '✅ Ticket entsperrt! User können wieder schreiben.', flags: MessageFlags.Ephemeral });
    },
};