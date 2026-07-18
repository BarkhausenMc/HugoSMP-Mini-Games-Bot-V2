const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../../database');

module.exports = {
    execute: async (interaction, { config, db }) => {
        const note = interaction.fields.getTextInputValue('note_text');

        if (config.STAFF_ROLE_ID) {
            const hasRole = interaction.member.roles.cache.has(String(config.STAFF_ROLE_ID));
            if (!hasRole && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: '❌ Nur Staff darf Notes schreiben!', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const channelId = String(interaction.channel.id);

        db.addNote({
            channelId,
            authorId: String(interaction.user.id),
            authorName: interaction.user.username,
            note,
            timestamp: new Date().toISOString(),
        });

        db.updateTicket(channelId, { last_activity: new Date().toISOString() });

        await interaction.reply({ content: '✅ Note intern gespeichert! Nur für Staff sichtbar.', flags: MessageFlags.Ephemeral });

        if (config.LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(config.LOG_CHANNEL_ID);
            if (logChannel) {
                const noteEmbed = new EmbedBuilder()
                    .setTitle('🔒 Staff Note Gespeichert')
                    .setDescription(note)
                    .setColor(0xffd700)
                    .setAuthor({ name: `${interaction.user.username} (ID: ${interaction.user.id})` })
                    .addFields({ name: 'Ticket', value: interaction.channel.name, inline: true })
                    .setFooter({ text: 'Nur für Staff sichtbar!' })
                    .setTimestamp();

                await logChannel.send({ embeds: [noteEmbed] }).catch(() => {});
            }
        }
    },
};