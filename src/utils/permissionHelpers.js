const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

function checkCategoryAccess(interaction, categoryKey) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;

    // ⭐ GIVEAWAY CLAIM: Giveaway Support Rolle oder Owner ⭐
    if (categoryKey === 'giveaway_claim') {
        if (config.GIVEAWAY_SUPPORT_ROLE_ID && interaction.member.roles.cache.has(String(config.GIVEAWAY_SUPPORT_ROLE_ID))) {
            return true;
        }
        const db = require('../database');
        const ticket = db.getTicket(String(interaction.channel.id));
        if (ticket && String(ticket.owner_id) === String(interaction.user.id)) {
            return true;
        }
        return false;
    }

    const categories = config.TICKET_CATEGORIES || {};
    const cat = categories[categoryKey];

    if (!cat) return true;
    if (!cat.allowedRoles || cat.allowedRoles.length === 0) return true;

    return cat.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
}

function getCategoryAccessMessage(categoryKey) {
    if (categoryKey === 'giveaway_claim') {
        return '(Benötigt: Giveaway Support Rolle oder Ticket-Owner)';
    }

    const categories = config.TICKET_CATEGORIES || {};
    const cat = categories[categoryKey];
    if (!cat || !cat.allowedRoles || cat.allowedRoles.length === 0) return '';
    return `(Benötigt: ${cat.allowedRoles.map(id => `<@&${id}>`).join(', ')})`;
}

module.exports = { checkCategoryAccess, getCategoryAccessMessage };