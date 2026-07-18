const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetstats')
        .setDescription('Resetet ALLE Ticket-Daten (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('bestätigung').setDescription("Schreibe 'RESET' um zu bestätigen").setRequired(true)
        ),

    execute: async (interaction, { config, db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            return;
        }

        const confirm = interaction.options.getString('bestätigung');
        if (confirm !== 'RESET') {
            await interaction.reply({ content: "❌ Du musst bei 'bestätigung' **RESET** eingeben!", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const tickets = db.getAllTickets();
            const total = tickets.length;
            const open = tickets.filter(t => !t.closed).length;
            const closed = tickets.filter(t => t.closed).length;

            // Delete all records
            for (const ticket of tickets) {
                db.deleteTicket(ticket.channel_id);
            }

            if (config.LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🔄 Ticket-Daten zurückgesetzt')
                        .setColor(0xfebf24)
                        .setTimestamp()
                        .addFields(
                            { name: 'Gesamte Tickets', value: String(total), inline: true },
                            { name: 'Offene Tickets', value: String(open), inline: true },
                            { name: 'Geschlossene Tickets', value: String(closed), inline: true },
                            { name: 'Ausgeführt von', value: interaction.user.toString(), inline: true }
                        )
                        .setFooter({ text: 'Backup wurde in SQLite erstellt!' });
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            await interaction.editReply({ content: `✅ **Alle Ticket-Daten wurden zurückgesetzt!**\n\n📊 **Vor dem Reset:**\n• Gesamt: ${total} Tickets\n• Offen: ${open}\n• Geschlossen: ${closed}` });
        } catch (err) {
            console.error('ResetStats Error:', err.message);
            await interaction.editReply({ content: '❌ Fehler beim Reset der Statistiken!' });
        }
    },
};