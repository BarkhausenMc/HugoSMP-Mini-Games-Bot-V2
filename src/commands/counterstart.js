

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');  // ← NICHT ../../database!
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counterstart')
        .setDescription('Startet einen neuen Counter in diesem Channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, { db }) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = String(interaction.channel.id);
        
        if (db.getCounter(channelId)) {
            await interaction.reply({ content: '⚠️ In diesem Channel gibt es bereits einen Counter!', flags: MessageFlags.Ephemeral });
            return;
        }

        db.initCounter(channelId, interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('🔢 Counter gestartet!')
            .setDescription(`**Zählen beginnt bei 1**\n\nErster User darf **1** sagen!\nDanach wechselt der Turn automatisch.\n\n**Regeln:**\n• Nur die nächste Zahl ist erlaubt\n• Abwechselnde User\n• Falsche Zahlen werden gelöscht`)
            .setColor(0x6d4aff)
            .setFooter({ text: `Startet durch ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};