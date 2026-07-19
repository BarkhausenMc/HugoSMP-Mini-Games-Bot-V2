const { EmbedBuilder } = require('discord.js');

module.exports = {
  customIdPrefix: 'giveaway_leave_',

  async execute(interaction) {
    const giveawayId = interaction.customId.replace('giveaway_leave_', '');

    const db = require('../../database');
    const giveaway = db.getGiveaway(giveawayId);

    // ⭐ ALLE ephemeral: true ERSETZEN DURCH flags: 64 ⭐
    if (!giveaway) {
      return interaction.reply({ content: '❌ Dieses Giveaway existiert nicht mehr.', flags: 64 });
    }

    if (giveaway.ended === 1) {
      return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet!', flags: 64 });
    }

    const entries = db.getGiveawayEntries(giveawayId);
    const isParticipating = entries.includes(interaction.user.id);

    if (!isParticipating) {
      return interaction.reply({ content: 'ℹ️ Du nimmst gar nicht an diesem Giveaway teil!', flags: 64 });
    }

    db.leaveGiveaway(giveawayId, interaction.user.id);

    const updatedEntries = db.getGiveawayEntries(giveawayId);
    const count = updatedEntries.length;

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const desc = embed.data.description.replace(/🎟️ \*\*Teilnehmer:\*\* \d+/, `🎟️ **Teilnehmer:** ${count}`);
    embed.setDescription(desc);

    await interaction.update({ embeds: [embed] });

    return interaction.followUp({ content: '🚪 Du hast das Giveaway verlassen. Schade! Vielleicht beim nächsten Mal. 👋', flags: 64 });
  }
};