const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketslowmode')
        .setDescription('Setzt Slowmode im Ticket')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(option =>
            option.setName('sekunden').setDescription('Sekunden zwischen Nachrichten (0-21600)').setRequired(true).setMinValue(0).setMaxValue(21600)
        )
        .addStringOption(option =>
            option.setName('channel_id').setDescription('Channel ID des Tickets (optional)').setRequired(false)
        ),

    execute: async (interaction, { config, db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const sekunden = interaction.options.getInteger('sekunden');
        const channelId = interaction.options.getString('channel_id');
        const targetChannelId = channelId || String(interaction.channel.id);
        const channel = interaction.guild.channels.cache.get(targetChannelId);

        if (!channel) {
            await interaction.reply({ content: '❌ Channel nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }
        if (channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: '❌ Nur in Text-Channels möglich!', flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            await channel.setRateLimitPerUser(sekunden);
        } catch (err) {
            console.error('Slowmode error:', err.message);
            await interaction.reply({ content: '❌ Fehler beim Setzen des Slowmodes!', flags: MessageFlags.Ephemeral });
            return;
        }

        const slowmodeText = sekunden === 0 ? 'Slowmode **entfernt**' : `Slowmode auf **${sekunden} Sek** gesetzt`;

        const slowEmbed = new EmbedBuilder()
            .setTitle('🕒 Slowmode aktualisiert')
            .setDescription(slowmodeText)
            .setColor(0x57f287)
            .setFooter({ text: `Durch ${interaction.user.tag}` })
            .setTimestamp();

        await channel.send({ embeds: [slowEmbed] });

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🕒 Slowmode aktualisiert')
                    .setColor(0x57f287)
                    .setTimestamp()
                    .addFields(
                        { name: 'Channel', value: channel.name, inline: true },
                        { name: 'Slowmode', value: sekunden === 0 ? 'Aus' : `${sekunden}s`, inline: true },
                        { name: 'Durch', value: interaction.user.toString(), inline: true }
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }
        }

        await interaction.reply({ content: `✅ Slowmode: **${slowmodeText}**!`, flags: MessageFlags.Ephemeral });
    },
};