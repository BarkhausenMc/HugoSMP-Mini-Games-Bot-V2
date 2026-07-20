const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

function buildGiveawayTicketRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claimen')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId('ticket_notes')
            .setLabel('Note schreiben')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝'),
        new ButtonBuilder()
            .setCustomId('ticket_show_notes')
            .setLabel('Notes anzeigen')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍'),
        new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Schließen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );
}

module.exports = {
  customIdPrefix: 'giveaway_claim_modal_',

  async execute(interaction) {
    const giveawayId = interaction.customId.replace('giveaway_claim_modal_', '');
    const minecraftName = interaction.fields.getTextInputValue('minecraft_name');

    const db = require('../../database');
    const giveaway = db.getGiveaway(giveawayId);

    if (!giveaway) {
      return interaction.reply({ content: '❌ Giveaway nicht gefunden!', flags: 64 });
    }

    const winners = db.getGiveawayWinners(giveawayId);
    if (!winners.includes(String(interaction.user.id))) {
      return interaction.reply({ content: '❌ Du hast dieses Giveaway nicht gewonnen!', flags: 64 });
    }

    if (db.hasClaimedGiveaway(giveawayId, interaction.user.id)) {
      return interaction.reply({ content: '⚠️ Du hast bereits geclaimed!', flags: 64 });
    }

    const guild = interaction.guild;
    const categoryId = config.GIVEAWAY_TICKET_CATEGORY_ID || null;

    const channelName = `giveaway-${minecraftName.toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 50);

    // ⭐ PERMISSIONS: Giveaway Support Rolle statt Staff ⭐
    const overwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    // Giveaway Support Rolle (statt STAFF_ROLE_ID!)
    if (config.GIVEAWAY_SUPPORT_ROLE_ID) {
      overwrites.push({
        id: config.GIVEAWAY_SUPPORT_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId ? categoryId : undefined,
      permissionOverwrites: overwrites,
    });

    const now = new Date().toISOString();
    db.createGiveawayClaim({
      giveawayId,
      userId: interaction.user.id,
      minecraftName,
      ticketChannelId: ticketChannel.id,
      claimedAt: now
    });

    db.createTicket({
      channelId: ticketChannel.id,
      ownerId: interaction.user.id,
      category: 'giveaway_claim',
      createdAt: now,
      lastActivity: now,
      claimedBy: null,
      closed: 0,
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎁 Giveaway Gewinn - Claim`)
      .setColor(0x6d4aff)
      .setDescription(
        `Hallo <@${interaction.user.id}>!\n\n` +
        `Du hast das Giveaway **${giveaway.title}** gewonnen! 🎉\n\n` +
        `**Deine Angaben:**\n` +
        `🎮 Minecraft-Name: \`${minecraftName}\`\n` +
        `🎉 Giveaway: ${giveaway.title}\n\n` +
        `Ein Giveaway-Support-Mitglied wird sich in Kürze um dich kümmern und deinen Gewinn überweisen.\n` +
        `Bitte habe etwas Geduld! 🙏`
      )
      .setFooter({ text: `Giveaway ID: ${giveawayId} | Ticket ID: ${ticketChannel.id}` })
      .setTimestamp();

    await ticketChannel.send({ 
      embeds: [embed],
      components: [buildGiveawayTicketRow()]
    });

    // ⭐ GIVEAWAY SUPPORT ROLLE PINGEN (nicht Staff!) ⭐
    if (config.GIVEAWAY_SUPPORT_ROLE_ID) {
      await ticketChannel.send(`<@&${config.GIVEAWAY_SUPPORT_ROLE_ID}> — Neuer Giveaway-Claim! 🎁`);
    }

    // ⭐ LOGGING ⭐
    if (config.GIVEAWAY_CLAIM_LOG_CHANNEL_ID) {
      try {
        const logChannel = await guild.channels.fetch(config.GIVEAWAY_CLAIM_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🎁 Giveaway Claim Erstellt')
            .setColor(0x6d4aff)
            .setDescription(
              `**Gewinner:** <@${interaction.user.id}>\n` +
              `**Minecraft-Name:** \`${minecraftName}\`\n` +
              `**Giveaway:** ${giveaway.title}\n` +
              `**Ticket:** <#${ticketChannel.id}>\n` +
              `**Zeit:** ${new Date(now).toLocaleString('de-DE')}`
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: `User ID: ${interaction.user.id} | Giveaway ID: ${giveawayId}` })
            .setTimestamp();
          
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error('Failed to send claim to log channel:', err.message);
      }
    }

    await interaction.reply({
      content: `✅ Dein Claim-Ticket wurde erstellt! Schau hier: <#${ticketChannel.id}>`,
      flags: 64
    });
  }
};