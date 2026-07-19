const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');  // ← CORRECTED!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('counterskip')
        .setDescription('Überspringt einen User (wenn User nicht reagiert)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(option =>
            option.setName('auszuschliessen').setDescription('User der übersprungen wird').setRequired(true)
        ),

    async execute(interaction, { db }) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = String(interaction.channel.id);
        const counter = db.getCounter(channelId);
        const excludedUser = interaction.options.getUser('auszuschliessen');

        if (!counter) {
            await interaction.reply({ content: '📭 Kein aktiver Counter!', flags: MessageFlags.Ephemeral });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('⏭️ Counter übersprungen')
            .setDescription(`<@${excludedUser.id}> wurde für diesen Turn übersprungen.\n\n**Nächster User** darf weiterzählen!`)
            .setColor(0xfebf24)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};