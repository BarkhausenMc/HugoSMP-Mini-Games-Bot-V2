const config = require('../config');
const db = require('../database');
const { EmbedBuilder } = require('discord.js');
const { getUserCounterStats, updateLeaderboard } = require('../utils/counterHelpers');

module.exports = {
    name: 'messageCreate',
    async execute(message, client, { config, db }) {
        console.log('[MESSAGE] Received:', message.author.tag, '| Channel:', message.channel.id);
        
        if (message.author.bot) {
            console.log('[MESSAGE] Ignoring bot message');
            return;
        }
        
        if (!message.guild) {
            console.log('[MESSAGE] Ignoring DM');
            return;
        }
        
        const category = message.channel.parent;
        const categoryName = category?.name?.toLowerCase() || '';
        
        const isCounterCategory = categoryName.includes('counter') || categoryName.includes('🔢');
        const allowedChannels = config.COUNTER_CHANNELS || [];
        const isAllowedChannel = allowedChannels.includes(String(message.channel.id));
        
        if (!isCounterCategory && !isAllowedChannel) {
            console.log('[MESSAGE] Not a counter channel:', categoryName || 'no category');
            return;
        }
        
        console.log('[MESSAGE] This is a COUNTER channel!');
        
        const channelId = String(message.channel.id);
        const counter = db.getCounter(channelId);
        
        console.log('[MESSAGE] Counter data:', counter ? 'EXISTS' : 'NOT FOUND');
        
        if (!counter) {
            console.log('[MESSAGE] No counter initialized in this channel');
            return;
        }
        
        const messageContent = message.content.trim();
        const expectedNumber = counter.number + 1;
        
        console.log('[MESSAGE] Expected:', expectedNumber, '| Got:', messageContent);
        
        const messageNumber = parseInt(messageContent);
        
        if (isNaN(messageNumber) || messageNumber !== expectedNumber) {
            console.log('[MESSAGE] Invalid input!');
            
            // ⭐ UNTERSCHEIDEN: Ist es überhaupt eine Zahl? ⭐
            if (isNaN(messageNumber)) {
                console.log('[MESSAGE] Not a number - just deleting, no reset');
                
                try {
                    await message.delete();
                    console.log('[MESSAGE] Non-number message deleted');
                } catch (err) {
                    console.log('[MESSAGE] Could not delete message:', err.message);
                }
                
                const warningEmbed = new EmbedBuilder()
                    .setColor(0xfacc15)
                    .setTitle('⚠️ ACHTUNG!')
                    .setDescription(
                        `${message.author}, im Counter schreibt man **nur Zahlen**!\n\n` +
                        `**Deine Nachricht wurde gelöscht!** Bitte schreib die richtige Zahl: **${expectedNumber}** 🔥`
                    )
                    .setTimestamp();
                
                await message.channel.send({ 
                    content: `${message.author}`,
                    embeds: [warningEmbed] 
                });
                console.log('[MESSAGE] Non-number warning sent');
                
                return;  // ⭐ COUNTER BLEIBT UNVERÄNDERT! ⭐
            }
            
            // ⭐ FALSCHE ZAHL (aber es war eine Zahl) - RESET! ⭐
            console.log('[MESSAGE] WRONG NUMBER! RESET COMPLETE COUNTER...');
            
            const stmt = db.prepare(
                `UPDATE counters SET number = 0, last_user_id = ?, updated_at = datetime('now'), reset_by = ?, reset_reason = ? 
                 WHERE channel_id = ?`
            );
            
            stmt.bind([
                null,
                String(message.author.id),
                'Wrong number: ' + messageNumber,
                String(message.channel.id)
            ]);
            stmt.step();
            stmt.free();
            db.save();
            
            console.log('[MESSAGE] Counter reset to 0');
            
            try {
                await message.delete();
                console.log('[MESSAGE] False number message deleted');
            } catch (err) {
                console.log('[MESSAGE] Could not delete user message:', err.message);
            }
            
            const warningEmbed = new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('❌ FALSCH! COUNTER GERESETET!')
                .setDescription(
                    `${message.author}, die richtige Zahl war **${expectedNumber}**, nicht ${messageNumber}!\n\n` +
                    `**Counter wurde zurückgesetzt!**\n\nNächster darf wieder mit **1** beginnen! 🔥`
                )
                .setFooter({ text: `Reset durch: ${message.author.tag}` })
                .setTimestamp();
            
            await message.channel.send({ embeds: [warningEmbed] });
            console.log('[MESSAGE] Reset warning sent (permanent)');
            return;
        }
        
        const currentUserId = String(message.author.id);
        
        console.log('[MESSAGE] User:', currentUserId);
        
        // ⭐ GLEICHER USER - ZWEITE ZAHL WIRD ÜBERSPRUNGEN! ⭐
        if (counter.last_user_id && counter.last_user_id === currentUserId) {
            console.log('[MESSAGE] SAME USER - ignoring second message');
            
            try {
                await message.delete();
                console.log('[MESSAGE] Same user message deleted');
            } catch (err) {
                console.log('[MESSAGE] Could not delete message:', err.message);
            }
            
            const warningEmbed = new EmbedBuilder()
                .setColor(0xfacc15)
                .setTitle('⚠️ ACHTUNG!')
                .setDescription(
                    `${message.author}, du hast die letzte Zahl gesagt!\n\n` +
                    `**Deine Nachricht wurde gelöscht!** Andere müssen auch zählen dürfen. 🙏\n\n` +
                    `Aktueller Stand: ${counter.number} → Nächste Zahl: **${counter.number + 1}**`
                )
                .setTimestamp();
            
            const reply = await message.channel.send({ 
                content: `${message.author}`,
                embeds: [warningEmbed] 
            });
            console.log('[MESSAGE] Same user warning sent');
            
            setTimeout(async () => {
                try { await reply.delete(); } catch (e) {}
            }, 10000);
            
            return;
        }
        
        console.log('[MESSAGE] ✅ SUCCESS! Incrementing counter...');
        db.incrementCounter(channelId, currentUserId);
        
        try {
            await message.react('✅');
            console.log('[MESSAGE] Reacted with ✅');
        } catch (err) {
            console.log('[MESSAGE] Could not react:', err.message);
        }
        
        try {
            const existingStats = getUserCounterStats(currentUserId);
            const userTotal = (existingStats?.total_count || 0) + 1;
            updateLeaderboard(currentUserId, message.author.username, userTotal);
            console.log('[MESSAGE] Leaderboard updated');
        } catch (err) {
            console.log('[MESSAGE] Leaderboard update error:', err.message);
        }
        
        if (messageNumber % 10 === 0) {
            const milestoneEmbed = new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle(`🎉 MILESTONE: ${messageNumber}!`)
                .setDescription(`${message.author} hat **${messageNumber}** erreicht! Weiter geht's mit ${messageNumber + 1}!`)
                .setFooter({ text: `Zuvor: ${counter.last_user_id ? '<@' + counter.last_user_id + '>' : 'Nobody'}` })
                .setTimestamp();
            
            await message.channel.send({ embeds: [milestoneEmbed] });
        }
        
        console.log('[MESSAGE] Counter complete!');
    },
};