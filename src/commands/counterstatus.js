const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database');  // ← CORRECT: ../ nicht ../../!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counterstatus')
        .setDescription('Zeigt den aktuellen Counter-Status'),

    async execute(interaction, { db }) {
        const channelId = String(interaction.channel.id);
        const counter = db.getCounter(channelId);

        if (!counter) {
            await interaction.reply({ content: '📭 Kein aktiver Counter in diesem Channel!', flags: MessageFlags.Ephemeral });
            return;
        }

        const nextNumber = counter.number + 1;
        const lastUser = counter.last_user_id ? `<@${counter.last_user_id}>` : 'Nobody';
        const createdAt = new Date(counter.created_at).toLocaleString('de-DE');

        const embed = new EmbedBuilder()
            .setTitle('🔢 Counter Status')
            .setDescription(`**Aktuelle Zahl:** ${counter.number}\n**Nächste Zahl:** ${nextNumber}\n**Letzter User:** ${lastUser}\n**Gestartet:** ${createdAt}`)
            .setColor(0x6d4aff)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};