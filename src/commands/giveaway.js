// src/commands/giveaway.js

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('🎮 Startet ein neues Giveaway')
    .addStringOption(option =>
      option.setName('titel')
        .setDescription('Wie soll das Giveaway heißen?')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('beschreibung')
        .setDescription('Kurze Info zum Giveaway')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('gewinner')
        .setDescription('Wie viele Gewinner?')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('dauer')
        .setDescription('Wie lange läuft das Giveaway? (in Minuten)')
        .setMinValue(1)
        .setMaxValue(43200) // 30 Tage max
        .setRequired(true)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('titel');
    const description = interaction.options.getString('beschreibung');
    const winnerCount = interaction.options.getInteger('gewinner');
    const durationMinutes = interaction.options.getInteger('dauer');

    const endTime = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

    // Einzigartige Giveaway ID generieren
    const giveawayId = `${interaction.guildId}-${Date.now()}`;

    // Giveaway Embed bauen
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
const embed = new EmbedBuilder()
    .setTitle(`🎉 ${title}`)
    .setDescription(
        `> ${description}\n\n` +
        `👥 **Gewinner:** ${winnerCount}\n` +
        `⏰ **Endet:** <t:${endTime}:R>` +  // ⭐ Nur relative Zeit beim Start! ⭐
        `\n🎟️ **Teilnehmer:** 0\n` +
        `👑 **Host:** <@${interaction.user.id}>`
    )
    .setColor(0x6d4aff)
    .setFooter({ text: `Giveaway ID: ${giveawayId}` })
    .setTimestamp();

const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId(`giveaway_join_${giveawayId}`)
        .setLabel('🎉 Teilnehmen')
        .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
        .setCustomId(`giveaway_leave_${giveawayId}`)
        .setLabel('🚪 Verlassen')
        .setStyle(ButtonStyle.Danger)
);

    await interaction.reply({ embeds: [embed], components: [row] });

    const message = await interaction.fetchReply();

    // In DB speichern
    const db = require('../database');
    await db.createGiveaway({
      id: giveawayId,
      messageId: message.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      title,
      description,
      winnerCount,
      endTime,
      hostId: interaction.user.id
    });
  }
};