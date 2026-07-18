const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const config = require('../../config');

module.exports = {
    execute: async (interaction, { config, db }) => {
        const channelId = String(interaction.channel.id);
        const ticket = db.getTicket(channelId);

        if (!ticket) {
            await interaction.update({ content: '❌ Ticket nicht gefunden!', components: [] });
            return;
        }

        // Skip button
        if (interaction.customId === 'in_ticket_rating_skip') {
            await interaction.update({ content: 'Bewertung übersprungen. Channel wird gelöscht... ⏳', components: [] });

            if (config.LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
                if (logChannel) {
                    const skipEmbed = new EmbedBuilder()
                        .setTitle('⏭️ Bewertung übersprungen')
                        .setColor(0x95a5a6)
                        .addFields(
                            { name: 'Ticket', value: interaction.channel.name, inline: true },
                            { name: 'Owner', value: `<@${ticket.owner_id}>`, inline: true }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [skipEmbed] });
                }
            }

            setTimeout(async () => {
                try { await interaction.channel.delete(); } catch (e) { console.error('Delete failed:', e.message); }
                // ⭐ KEIN db.deleteTicket()! Daten bleiben für Stats! ⭐
            }, 3000);
            return;
        }

        // Only ticket owner can rate
        if (String(interaction.user.id) !== ticket.owner_id) {
            await interaction.reply({ content: '❌ Nur der Ticket-Ersteller darf bewerten!', flags: MessageFlags.Ephemeral });
            return;
        }

        // Extract stars
        const stars = parseInt(interaction.customId.replace('in_ticket_rating_', ''));

        db.updateTicket(channelId, { rating: stars });
        db.addRating({
            channelId,
            stars,
            ratedAt: new Date().toISOString(),
            ownerId: ticket.owner_id,
        });

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const ratingEmbed = new EmbedBuilder()
                    .setTitle('⭐ Ticket Bewertung')
                    .setColor(0xffd700)
                    .setTimestamp()
                    .addFields(
                        { name: 'Sterne', value: '⭐'.repeat(stars), inline: true },
                        { name: 'Ticket', value: interaction.channel.name, inline: true },
                        { name: 'Bewertet von', value: `<@${ticket.owner_id}>`, inline: true }
                    );

                if (ticket.claimed_by) {
                    ratingEmbed.addFields({ name: 'Geclaimt von', value: `<@${ticket.claimed_by}>`, inline: true });
                }

                await logChannel.send({ embeds: [ratingEmbed] });
            }
        }

        const thankEmbed = new EmbedBuilder()
            .setTitle('✅ Danke für deine Bewertung!')
            .setDescription(`Du hast mit **${stars} ⭐** bewertet.\nChannel wird in 3 Sekunden gelöscht...`)
            .setColor(0x57f287)
            .setTimestamp();

        await interaction.update({ embeds: [thankEmbed], components: [] });

        setTimeout(async () => {
            try { await interaction.channel.delete(); } catch (e) { console.error('Delete failed:', e.message); }
            // ⭐ KEIN db.deleteTicket() HIER! Daten bleiben für Stats erhalten! ⭐
        }, 3000);
    },
};