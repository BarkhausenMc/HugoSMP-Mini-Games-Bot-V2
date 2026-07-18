module.exports = {
    execute: async (interaction) => {
        await interaction.update({ content: 'Ticket bleibt offen. ✅', components: [] });
    },
};