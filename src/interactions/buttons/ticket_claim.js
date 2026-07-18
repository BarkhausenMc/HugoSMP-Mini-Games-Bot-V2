const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database');
const config = require('../../config');
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
                await interaction.reply({ content: '❌ Nur Staff darf Tickets claimen!', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        if (ticket.claimed_by) {
            await interaction.reply({ content: `👤 Dieses Ticket wurde bereits von <@${ticket.claimed_by}> geclaimt!`, flags: MessageFlags.Ephemeral });
            return;
        }

        db.updateTicket(channelId, {
            claimed_by: interaction.user.id,
            last_activity: new Date().toISOString(),
        });

        try {
            const oldName = interaction.channel.name;
            const claimedPrefix = `claimed-${interaction.user.username}-`;
            const safeName = `${claimedPrefix}${oldName}`;
            await interaction.channel.setName(safeName.slice(0, 100));
        } catch (err) {
            console.error('Channel name update failed:', err.message);
        }

        try {
            await interaction.channel.edit({
                topic: interaction.channel.topic.replace('Claim: None', `Claim: ${interaction.user.id}`),
            });
        } catch (err) {
            console.error('Topic update failed:', err.message);
        }

        const claimEmbed = new EmbedBuilder()
            .setTitle('✅ Ticket geclaimt')
            .setDescription(`${interaction.user} hat dieses Ticket übernommen!`)
            .setColor(0x57f287)
            .setTimestamp();

        await interaction.reply({ embeds: [claimEmbed] });
    },
};