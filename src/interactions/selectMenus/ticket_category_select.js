const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    execute: async (interaction, { config }) => {
        const categoryKey = interaction.values[0];
        const cat = config.TICKET_CATEGORIES[categoryKey];

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${categoryKey}`)
            .setTitle(`${cat.emoji || '🎫'} ${categoryKey}`);

        cat.questions.forEach((q, index) => {
            const input = new TextInputBuilder()
                .setCustomId(`question_${index}`)
                .setLabel(q.label)
                .setStyle(q.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(q.required !== false);

            if (q.placeholder) input.setPlaceholder(q.placeholder);
            input.setMaxLength(1000);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
        });

        await interaction.showModal(modal);
    },
};