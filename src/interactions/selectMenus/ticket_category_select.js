const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    execute: async (interaction, { config }) => {
        const categoryKey = interaction.values?.[0];
        
        console.log('🎯 [SELECT MENU] Category selected:', categoryKey);
        
        // ⭐ KEIN deferReply() - Modal IST die Antwort! ⭐
        
        if (!categoryKey || !config.TICKET_CATEGORIES[categoryKey]) {
            console.error('❌ [SELECT MENU] Invalid category:', categoryKey);
            return; // Einfach abbrechen - keine Antwort nötig
        }
        
        const cat = config.TICKET_CATEGORIES[categoryKey];
        
        console.log('✅ [SELECT MENU] Valid category:', categoryKey);
        
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${categoryKey}`)
            .setTitle(`${cat.emoji || '🎫'} ${categoryKey}`);
        
        const questions = cat.questions || [];
        
        questions.forEach((q, index) => {
            const input = new TextInputBuilder()
                .setCustomId(`question_${index}`)
                .setLabel(q.label)
                .setStyle(q.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(q.required !== false);
            
            if (q.placeholder) input.setPlaceholder(q.placeholder);
            input.setMaxLength(1000);
            
            modal.addComponents(new ActionRowBuilder().addComponents(input));
        });
        
        try {
            console.log('📝 [SELECT MENU] Showing modal...');
            await interaction.showModal(modal);
            console.log('✅ [SELECT MENU] Modal displayed successfully!');
        } catch (err) {
            console.error('❌ [SELECT MENU] Failed to show modal:', err.message);
        }
    },
};