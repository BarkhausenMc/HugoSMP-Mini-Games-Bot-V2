// src/events/guildMemberAdd.js
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
    name: 'guildMemberAdd',
    once: true,
    async execute(member, client) {
        // 1. Prüfen, ob wir im richtigen Server sind
        if (member.guild.id !== config.SERVER_ID) return;

        console.log(`[WELCOME] ${member.user.tag} ist beigetreten!`);

        // 2. Den Willkommen-Kanal HOLEN (über die ID aus .env)
        const welcomeChannelId = config.WELCOME_CHANNEL_ID;
        
        if (!welcomeChannelId) {
            console.error('[WELCOME] ERROR: WELCOME_CHANNEL_ID fehlt in .env oder config!');
            return;
        }

        const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId).catch(err => {
            console.error('[WELCOME] ERROR: Kanal nicht gefunden:', err.message);
            return null;
        });

        if (!welcomeChannel) {
            console.error(`[WELCOME] ERROR: Kanal mit ID ${welcomeChannelId} existiert nicht oder Bot hat keine Rechte!`);
            return;
        }

        // 3. Memberzahl holen
        const memberCount = member.guild.memberCount;

        // 4. Das Embed bauen
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0xb56cff) // HugoSMP Purple
            .setTitle(`🎉 Willkommen auf dem HugoSMP Mini-Games Discord Server!`)
            .setDescription(`
Schön, dass du da bist! 👋

Das ist der **Offizielle** **HugoSMP Mini-Games Website** **Discord**.
Falls du **Fragen** oder **Probleme** hast erstelle ein **Ticket** in <#1507833535371804672>.\n
🚀 **Wichtig:**
• Wir sind jetzt **${memberCount} Mitglieder**! (Giveaways bald aktiv!)
• 🧪 **Beta Tester gesucht:** Bewirb dich im <#1519771642723700776>!\n
            `)
            .addFields(
                {
                    name: '📜 Erste Schritte',
                    value: '1. Lies die Regeln und Akzeptiere sie im <#1508037556296745032>\n ',
                    inline: false
                },
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: 'HugoSMP Mini-Games Website • URL', iconURL: member.guild.iconURL() })
            .setTimestamp();

        // 5. Nachricht senden
        try {
            await welcomeChannel.send({
                content: `${member} ist beigetreten! 👋`,
                embeds: [welcomeEmbed]
            });
            console.log(`[WELCOME] Nachricht erfolgreich gesendet an ${welcomeChannel.name}.`);
        } catch (error) {
            console.error('[WELCOME] Fehler beim Senden:', error.message);
        }
    }
};