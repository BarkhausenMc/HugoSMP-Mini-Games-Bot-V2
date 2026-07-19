const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getTopCounters } = require('../utils/counterHelpers');  // ← CORRECT: ../ nicht ../../!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counterleaderboard')
        .setDescription('Zeigt Top-User im Zählen'),

    async execute(interaction, { db }) {
        const topCounters = getTopCounters(10);

        if (topCounters.length === 0) {
            await interaction.reply({ content: '🏆 Noch keine Statistiken vorhanden!', flags: MessageFlags.Ephemeral });
            return;
        }

        const leaderboardText = topCounters.map((stat, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} <@${stat.user_id}> — **${stat.total_count}** gezählt`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Counter Leaderboard')
            .setDescription(leaderboardText)
            .setColor(0xffd700)
            .setFooter({ text: 'Top 10 User insgesamt' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};