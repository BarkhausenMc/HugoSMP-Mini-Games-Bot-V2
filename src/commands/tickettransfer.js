const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickettransfer')
        .setDescription('Überträgt ein Ticket an ein anderes Teammitglied')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addUserOption(option =>
            option.setName('ziel_user').setDescription('Teammitglied dem du das Ticket übergibst').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('channel_id').setDescription('Channel ID des Tickets (optional)').setRequired(false)
        ),

    execute: async (interaction, { config, db }) => {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ Manage Channels Rechte benötigt!', flags: MessageFlags.Ephemeral });
            return;
        }

        const channelId = interaction.options.getString('channel_id');
        const targetUser = interaction.options.getUser('ziel_user');
        const targetChannelId = channelId || String(interaction.channel.id);
        const ticket = db.getTicket(targetChannelId);

        if (!ticket) {
            await interaction.reply({ content: '❌ Ticket nicht gefunden!', flags: MessageFlags.Ephemeral });
            return;
        }
        if (ticket.closed) {
            await interaction.reply({ content: '❌ Kann kein geschlossenes Ticket übertragen!', flags: MessageFlags.Ephemeral });
            return;
        }

        const oldOwner = ticket.owner_id;
        const newOwner = String(targetUser.id);

        db.updateTicket(targetChannelId, {
            owner_id: newOwner,
            last_activity: new Date().toISOString(),
        });

        const transferEmbed = new EmbedBuilder()
            .setTitle('🔄 Ticket übertragen')
            .setDescription(`Dieses Ticket wurde von <@${oldOwner}> an <@${newOwner}> übertragen.\n\n**Übertragen von:** ${interaction.user}\n**Neuer Owner:** ${targetUser.toString()}`)
            .setColor(0x57f287)
            .setTimestamp();

        const channel = interaction.guild.channels.cache.get(targetChannelId);
        if (channel) {
            await channel.send({ embeds: [transferEmbed] });
        }

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔄 Ticket übertragen')
                    .setColor(0xfebf24)
                    .setTimestamp()
                    .addFields(
                        { name: 'Ticket', value: channel?.name || 'N/A', inline: true },
                        { name: 'Von', value: `<@${oldOwner}>`, inline: true },
                        { name: 'Zu', value: `<@${newOwner}>`, inline: true },
                        { name: 'Durch', value: interaction.user.toString(), inline: true }
                    );
                await logChannel.send({ embeds: [logEmbed] });
            }
        }

        await interaction.reply({ content: `✅ Ticket erfolgreich an **${targetUser.displayName}** übertragen!`, flags: MessageFlags.Ephemeral });
    },
};