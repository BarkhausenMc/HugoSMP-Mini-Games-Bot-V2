const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
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
            await interaction.reply({ content: `❌ Du darfst keine Notes zu diesem Ticket schreiben!\n${getCategoryAccessMessage(ticket.category)}`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (config.STAFF_ROLE_ID) {
            const hasRole = interaction.member.roles.cache.has(String(config.STAFF_ROLE_ID));
            if (!hasRole && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Nur Staff darf Notes schreiben!', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const modal = new ModalBuilder()
            .setCustomId('staff_note_modal')
            .setTitle('📝 Interne Staff Note');

        const noteInput = new TextInputBuilder()
            .setCustomId('note_text')
            .setLabel('Interne Notiz (nur für Staff sichtbar)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Schreib hier was rein...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
        await interaction.showModal(modal);
    },
};