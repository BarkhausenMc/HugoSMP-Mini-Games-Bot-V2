const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketstats')
        .setDescription('Zeigt Ticket Statistiken (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { db }) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Admin only!', flags: MessageFlags.Ephemeral });
            return;
        }

        const tickets = db.getAllTickets();
        const total = tickets.length;
        const closed = tickets.filter(t => t.closed).length;
        const open = total - closed;

        const rated = tickets.filter(t => t.rating !== null && t.rating !== undefined);
        const avgRating = rated.length > 0
            ? (rated.reduce((sum, t) => sum + t.rating, 0) / rated.length).toFixed(2)
            : null;

        const categoryCounts = {};
        tickets.forEach(t => {
            categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        });

        const embed = new EmbedBuilder()
            .setTitle('📊 HugoSMP Ticket Statistics')
            .setColor(0x6d4aff)
            .addFields(
                { name: 'Gesamt Tickets', value: String(total), inline: true },
                { name: 'Offene Tickets', value: String(open), inline: true },
                { name: 'Geschlossen', value: String(closed), inline: true },
                { name: 'Ø Bewertung', value: avgRating ? `⭐${avgRating}` : 'Keine Bewertungen', inline: true },
                { name: '📁 Nach Kategorie', value: Object.entries(categoryCounts).map(([k, v]) => `${k}: ${v}`).join('\n') || 'Keine Tickets', inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};