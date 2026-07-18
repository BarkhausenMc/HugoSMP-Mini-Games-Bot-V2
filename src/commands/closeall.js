const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('closeall')
        .setDescription('Schließt ALLE offenen Tickets (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('bestätigung').setDescription("Schreibe 'JA' um zu bestätigen").setRequired(true)
        ),

    execute: async (interaction, { config, db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            return;
        }

        const confirm = interaction.options.getString('bestätigung');
        if (confirm !== 'JA') {
            await interaction.reply({ content: "❌ Du musst bei 'bestätigung' **JA** eingeben!", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const openTickets = db.getOpenTickets();

            if (openTickets.length === 0) {
                await interaction.editReply({ content: '📭 Es gibt keine offenen Tickets!' });
                return;
            }

            let closedCount = 0;
            let failedCount = 0;

            for (const ticket of openTickets) {
                try {
                    db.updateTicket(ticket.channel_id, {
                        closed: 1,
                        closed_at: new Date().toISOString(),
                        last_activity: new Date().toISOString(),
                    });

                    const channel = interaction.guild.channels.cache.get(ticket.channel_id);
                    if (channel) {
                        try {
                            if (ticket.owner_id) {
                                await channel.permissionOverwrites.edit(ticket.owner_id, {
                                    ViewChannel: true, SendMessages: false, ReadMessageHistory: true,
                                });
                            }
                        } catch {}

                        try {
                            const closeEmbed = new EmbedBuilder()
                                .setTitle('🔒 Ticket geschlossen (Massenschließung)')
                                .setDescription('Dieses Ticket wurde durch einen Admin geschlossen.')
                                .setColor(0xed4245)
                                .setTimestamp();
                            await channel.send({ embeds: [closeEmbed] });
                        } catch {}
                    }
                    closedCount++;
                } catch (err) {
                    console.error(`Fehler beim Schließen von Ticket ${ticket.channel_id}:`, err.message);
                    failedCount++;
                }
            }

            if (config.LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🔒 Massenschließung - Alle Tickets geschlossen')
                        .setColor(0xed4245)
                        .setTimestamp()
                        .addFields(
                            { name: 'Geschlossen', value: String(closedCount), inline: true },
                            { name: 'Fehlgeschlagen', value: String(failedCount), inline: true },
                            { name: 'Ausgeführt von', value: interaction.user.toString(), inline: true }
                        );
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            await interaction.editReply({ content: `✅ **${closedCount}** Tickets wurden geschlossen!${failedCount > 0 ? `\n⚠️ ${failedCount} fehlgeschlagen.` : ''}` });
        } catch (err) {
            console.error('CloseAll Error:', err.message);
            await interaction.editReply({ content: '❌ Fehler beim Massenschließen!' });
        }
    },
};