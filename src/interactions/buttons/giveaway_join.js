const { EmbedBuilder } = require('discord.js');

module.exports = {
  customIdPrefix: 'giveaway_join_',

  async execute(interaction) {
    const giveawayId = interaction.customId.replace('giveaway_join_', '');

    const db = require('../../database');
    const giveaway = db.getGiveaway(giveawayId);

    if (!giveaway) {
      return interaction.reply({ content: '❌ Dieses Giveaway existiert nicht mehr.', flags: 64 });
    }

    if (giveaway.ended === 1) {
      return interaction.reply({ content: '❌ Dieses Giveaway ist bereits beendet!', flags: 64 });
    }

    if (interaction.user.id === giveaway.host_id) {
      return interaction.reply({ content: '❌ Du kannst nicht an deinem eigenen Giveaway teilnehmen!', flags: 64 });
    }

    // ⭐ joinGiveaway ist SYNCHRON, kein await! ⭐
    const joined = db.joinGiveaway(giveawayId, interaction.user.id);

    if (joined) {
      const entries = db.getGiveawayEntries(giveawayId);
      const count = entries.length;

      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      const desc = embed.data.description.replace(/🎟️ \*\*Teilnehmer:\*\* \d+/, `🎟️ **Teilnehmer:** ${count}`);
      embed.setDescription(desc);

      await interaction.update({ embeds: [embed] });

      return interaction.followUp({ content: '✅ Du nimmst am Giveaway teil! Viel Glück! 🍀', flags: 64 });
    } else {
      // ⭐ HIER IST DEINE FEHL-NACHRICHT! ⭐
      return interaction.reply({
        content: '⚠️ Du nimmst **bereits** an diesem Giveaway teil!\nMöchtest du dich abmelden? Klicke dafür auf den **🚪 Verlassen** Button!',
        flags: 64
      });
    }
  }
};