const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database');
const config = require('../../config');
const { buildConfirmCloseRow } = require('../../utils/embedHelpers');

module.exports = {
    execute: async (interaction, { config, db }) => {
        const channelId = String(interaction.channel.id);
        const ticket = db.getTicket(channelId);

        if (!ticket) {
            await interaction.reply({ content: '❌ Ticket-Daten nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }

        const isOwner = String(interaction.user.id) === ticket.owner_id;
        const hasStaff = config.STAFF_ROLE_ID && interaction.member.roles.cache.has(String(config.STAFF_ROLE_ID));
        const hasAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

        if (!isOwner && !hasStaff && !hasAdmin) {
            await interaction.reply({ content: '❌ Keine Berechtigung zum Schließen!', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.reply({
            content: '⚠️ Möchtest du dieses Ticket wirklich schließen? Danach kommt ein Bewertungsfenster!',
            components: [buildConfirmCloseRow()],
        });
    },
};