const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Erstellt das Ticket Panel mit Dropdown-Menü')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    execute: async (interaction, { config }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Du brauchst \'Manage Channels\' Rechte!', flags: MessageFlags.Ephemeral });
            return;
        }

        const categories = config.TICKET_CATEGORIES;
        const categoryList = Object.entries(categories)
            .map(([key, cat]) => `• ${cat.emoji || '🎫'} **${key}**`)
            .join('\n');

        const options = Object.entries(categories).map(([key, cat]) => ({
            label: `${cat.emoji || '🎫'}│ ${key}`,
            value: key,
        }));

        const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_category_select')
                .setPlaceholder('🎫 Wähle eine Kategorie...')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(options)
        );

        const embed = new EmbedBuilder()
            .setTitle('🎫 HugoSMP Support System')
            .setDescription(
                `Willkommen beim HugoSMP Support!\n\n` +
                `Wähle unten aus dem Dropdown-Menü eine Kategorie aus.\n` +
                `Je nach Kategorie werden dir passende Fragen gestellt. 📝\n\n` +
                `**Verfügbare Kategorien:**\n${categoryList}`
            )
            .setColor(0x6d4aff)
            .setFooter({ text: 'HugoSMP Mini-Games Platform' });

        await interaction.reply({ embeds: [embed], components: [selectMenu] });
    },
};