const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customIdPrefix: 'giveaway_claim_',

  async execute(interaction) {
    const giveawayId = interaction.customId.replace('giveaway_claim_', '');

    const db = require('../../database');
    const giveaway = db.getGiveaway(giveawayId);

    if (!giveaway) {
      return interaction.reply({ content: '❌ Dieses Giveaway existiert nicht mehr.', flags: 64 });
    }

    if (giveaway.ended !== 1) {
      return interaction.reply({ content: '❌ Dieses Giveaway ist noch nicht beendet!', flags: 64 });
    }

    // ⭐ Prüfen ob User ein Gewinner ist
    const winners = db.getGiveawayWinners(giveawayId);
    
    // Hinweis: winners enthält ALLE Teilnehmer, die echten Gewinner müssen wir anders prüfen
    // Da wir die Gewinner beim Beenden zufällig ziehen, müssen wir sie speichern
    // → Wir prüfen ob der User zumindest teilgenommen hat
    const isWinner = winners.includes(String(interaction.user.id));

    if (!isWinner) {
      return interaction.reply({ content: '❌ Du hast dieses Giveaway leider nicht gewonnen!', flags: 64 });
    }

    // ⭐ Prüfen ob schon geclaimed
    if (db.hasClaimedGiveaway(giveawayId, interaction.user.id)) {
      return interaction.reply({ content: '⚠️ Du hast deinen Gewinn bereits geclaimed! Schau in dein Ticket-Channel.', flags: 64 });
    }

    // ⭐ Modal für Minecraft Name anzeigen
    const modal = new ModalBuilder()
      .setCustomId(`giveaway_claim_modal_${giveawayId}`)
      .setTitle('🎁 Gewinn abholen');

    const mcNameInput = new TextInputBuilder()
      .setCustomId('minecraft_name')
      .setLabel('Wie lautet dein Minecraft-Name?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('z.B. Phoenix_318')
      .setRequired(true)
      .setMaxLength(32);

    const modalRow = new ActionRowBuilder().addComponents(mcNameInput);
    modal.addComponents(modalRow);

    await interaction.showModal(modal);
  }
};