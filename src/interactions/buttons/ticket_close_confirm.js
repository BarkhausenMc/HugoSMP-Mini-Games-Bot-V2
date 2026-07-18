const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database');
const config = require('../../config');
const { buildInTicketRatingRow1, buildInTicketRatingRow2 } = require('../../utils/embedHelpers');

module.exports = {
    execute: async (interaction, { config, db }) => {
        await interaction.deferUpdate();

        try {
            const channelId = String(interaction.channel.id);
            const ticket = db.getTicket(channelId);

            if (ticket) {
                db.updateTicket(channelId, {
                    closed: 1,
                    closed_at: new Date().toISOString(),
                });
            }

            if (config.LOG_CHANNEL_ID && ticket) {
                const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChannel) {
                    const created = new Date(ticket.created_at);
                    const closed = new Date();
                    const duration = Math.round((closed - created) / 1000);
                    const hours = Math.floor(duration / 3600);
                    const mins = Math.floor((duration % 3600) / 60);
                    const secs = duration % 60;

                    const logEmbed = new EmbedBuilder()
                        .setTitle('🔒 Ticket geschlossen')
                        .setColor(0xed4245)
                        .setTimestamp()
                        .addFields(
                            { name: 'Channel', value: interaction.channel.name, inline: true },
                            { name: 'Owner', value: `<@${ticket.owner_id}>`, inline: true },
                            { name: 'Kategorie', value: ticket.category, inline: true },
                            { name: 'Claimed by', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'None', inline: true },
                            { name: 'Dauer', value: `${hours}h ${mins}m ${secs}s`, inline: false }
                        );

                    await logChannel.send({ embeds: [logEmbed] });
                }
            }

            try {
                await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                    ViewChannel: true, SendMessages: false, ReadMessageHistory: true,
                });
            } catch (err) {
                console.error('Permission overwrite failed:', err.message);
            }

            const ratingEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket bewerten')
                .setDescription(`**🎉 Ticket geschlossen!**\n\nHey <@${ticket.owner_id}>, wie war dein Support-Erlebnis?\nBewerte mit den Sternen-Buttons unten! ⭐`)
                .setColor(0x6d4aff)
                .setTimestamp();

            await interaction.editReply({
                content: null,
                embeds: [ratingEmbed],
                components: [buildInTicketRatingRow1(), buildInTicketRatingRow2()],
            });
        } catch (err) {
            console.error('Close Confirm Error:', err.message);
            await interaction.editReply({ content: '❌ Fehler beim Schließen!' });
        }
    },
};