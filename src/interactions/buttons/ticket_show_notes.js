const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database');
const { checkCategoryAccess, getCategoryAccessMessage } = require('../../utils/permissionHelpers');

module.exports = {
    execute: async (interaction, { config, db }) => {
        const channelId = String(interaction.channel.id);
        const ticket = db.getTicket(channelId);

        if (!ticket) {
            await interaction.reply({ content: '❌ Ticket-Daten nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!checkCategoryAccess(interaction, ticket.category)) {
            await interaction.reply({ content: `❌ Du hast keinen Zugriff auf dieses Ticket!\n${getCategoryAccessMessage(ticket.category)}`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (config.STAFF_ROLE_ID) {
            const hasRole = interaction.member.roles.cache.has(String(config.STAFF_ROLE_ID));
            if (!hasRole && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Nur Staff darf Notes ansehen!', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const notes = db.getNotes(channelId);

        if (!notes || notes.length === 0) {
            await interaction.reply({ content: '📭 Keine Staff Notes vorhanden.', flags: MessageFlags.Ephemeral });
            return;
        }

        const notesEmbed = new EmbedBuilder()
            .setTitle('🔍 Interne Staff Notes')
            .setColor(0xffd700)
            .setDescription(`**Ticket:** ${interaction.channel.name}\n**Notizen:** ${notes.length}`);

        notes.forEach((note, index) => {
            const date = new Date(note.timestamp).toLocaleString('de-DE');
            notesEmbed.addFields({
                name: `📝 Note #${index + 1} — ${note.author_name} • ${date}`,
                value: note.note,
                inline: false,
            });
        });

        notesEmbed.setFooter({ text: 'Nur für Staff sichtbar!' });
        await interaction.reply({ embeds: [notesEmbed], flags: MessageFlags.Ephemeral });
    },
};