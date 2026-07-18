const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staffnotes')
        .setDescription('Zeigt interne Staff Notes eines Tickets (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('channel_id').setDescription('Channel ID des Tickets').setRequired(true)
        ),

    execute: async (interaction, { db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = interaction.options.getString('channel_id');
        const ticket = db.getTicket(channelId);

        if (!ticket) {
            await interaction.reply({ content: '❌ Ticket nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }

        const notes = db.getNotes(channelId);

        if (!notes || notes.length === 0) {
            await interaction.reply({ content: '📭 Keine Staff Notes vorhanden.', flags: MessageFlags.Ephemeral });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔒 Interne Staff Notes')
            .setColor(0xffd700);

        notes.forEach(note => {
            const date = new Date(note.timestamp).toLocaleString('de-DE');
            embed.addFields({ name: `${note.author_name} • ${date}`, value: note.note, inline: false });
        });

        await interaction.user.send({ embeds: [embed] }).catch(() => {
            interaction.reply({ content: '❌ Konnte dir keine DM senden! Bitte aktiviere DMs vom Server.', flags: MessageFlags.Ephemeral });
            return;
        });

        await interaction.reply({ content: '📨 Notes per DM gesendet!', flags: MessageFlags.Ephemeral });
    },
};