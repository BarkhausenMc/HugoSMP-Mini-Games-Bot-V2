const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

function checkCategoryAccess(interaction, categoryKey) {
    const categories = config.TICKET_CATEGORIES;
    const cat = categories[categoryKey];

    if (!cat.allowedRoles || cat.allowedRoles.length === 0) return true;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return true;

    return cat.allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
}

function getCategoryAccessMessage(categoryKey) {
    const categories = config.TICKET_CATEGORIES;
    const cat = categories[categoryKey];
    if (!cat.allowedRoles || cat.allowedRoles.length === 0) return '';
    return `(Benötigt: ${cat.allowedRoles.map(id => `<@&${id}>`).join(', ')})`;
}

module.exports = { checkCategoryAccess, getCategoryAccessMessage };