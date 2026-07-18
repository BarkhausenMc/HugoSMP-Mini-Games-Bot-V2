const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketlock')
        .setDescription('Schließt das Ticket für den User (temporär)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option.setName('grund').setDescription('Grund für die Sperrung').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('channel_id').setDescription('Channel ID des Tickets (optional)').setRequired(false)
        ),

    async execute(interaction, { config, db }) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = interaction.options.getString('channel_id');
        const grund = interaction.options.getString('grund');
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
        if (ticket.locked) {
            await interaction.reply({ content: '⚠️ Ticket ist bereits gesperrt!', flags: MessageFlags.Ephemeral });
            return;
        }

        db.updateTicket(targetChannelId, {
            locked: 1,
            lock_reason: grund,
            lock_by: interaction.user.id,
            lock_at: new Date().toISOString(),
            last_activity: new Date().toISOString(),
        });

        if (ticket.owner_id) {
            try {
                await channel.permissionOverwrites.edit(ticket.owner_id, {
                    ViewChannel: true, SendMessages: false, ReadMessageHistory: true,
                });
            } catch (err) {
                console.error('Lock permission error:', err.message);
            }  // ← HIER KEIN 's'!
        }

        const lockEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket gesperrt')
            .setDescription(`Dieses Ticket wurde temporär gesperrt.\n\n**Grund:** ${grund}\n**Gesperrt von:** ${interaction.user}\n\nNutze \`/ticketunlock\` um das Ticket wieder freizugeben.`)
            .setColor(0xed4245)
            .setTimestamp();

        await channel.send({ embeds: [lockEmbed] });

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔒 Ticket gesperrt')
                    .setColor(0xed4245)
                    .setTimestamp()
                    .addFields(
                        { name: 'Channel', value: channel.name, inline: true },
                        { name: 'Grund', value: grund, inline: false },
                        { name: 'Durch', value: interaction.user.toString(), inline: true }
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }
        }

        await interaction.reply({ content: '✅ Ticket gesperrt! User können keine Nachrichten mehr senden.', flags: MessageFlags.Ephemeral });
    },
};