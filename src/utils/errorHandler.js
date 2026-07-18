async function logError(interaction, error, context = 'Unknown') {
    const timestamp = new Date().toISOString();
    const user = interaction.user?.tag || 'Unknown';
    const command = interaction.commandName || interaction.customId || 'Unknown';
    const channel = interaction.channel?.name || 'Unknown';

    console.error(`[${timestamp}] ❌ ERROR in ${context}:`);
    console.error(`   User: ${user}`);
    console.error(`   Command/Button: ${command}`);
    console.error(`   Channel: ${channel}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
}

async function safeReply(interaction, message) {
    try {
        if (interaction.deferred) {
            await interaction.editReply({ content: message });
        } else if (interaction.replied) {
            await interaction.followUp({ content: message, flags: 64 });
        } else {
            await interaction.reply({ content: message, flags: 64 });
        }
    } catch (err) {
        console.error('Failed to send error reply:', err.message);
    }
}

module.exports = { logError, safeReply };