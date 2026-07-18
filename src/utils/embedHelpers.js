const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildTicketActionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claimen')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('ticket_notes')
            .setLabel('Note schreiben')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝'),
        new ButtonBuilder()
            .setCustomId('ticket_show_notes')
            .setLabel('Notes anzeigen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍'),
        new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Schließen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );
}

function buildConfirmCloseRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_close_confirm')
            .setLabel('Ja, schließen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('ticket_close_cancel')
            .setLabel('Abbrechen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
    );
}

function buildInTicketRatingRow1() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('in_ticket_rating_5')
            .setLabel('⭐⭐⭐⭐⭐')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('in_ticket_rating_4')
            .setLabel('⭐⭐⭐⭐')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('in_ticket_rating_3')
            .setLabel('⭐⭐⭐')
            .setStyle(ButtonStyle.Success)
    );
}

function buildInTicketRatingRow2() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('in_ticket_rating_2')
            .setLabel('⭐⭐')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('in_ticket_rating_1')
            .setLabel('⭐')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('in_ticket_rating_skip')
            .setLabel('Überspringen')
            .setStyle(ButtonStyle.Secondary)
    );
}

module.exports = {
    buildTicketActionRow,
    buildConfirmCloseRow,
    buildInTicketRatingRow1,
    buildInTicketRatingRow2
};