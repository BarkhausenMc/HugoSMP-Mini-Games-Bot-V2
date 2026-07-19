const config = require('../config');
const db = require('../database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client, { config, db }) {
        console.log('[MESSAGE] Received:', message.author.tag, '| Channel:', message.channel.id);
        
        // Ignore bots
        if (message.author.bot) {
            console.log('[MESSAGE] Ignoring bot message');
            return;
        }
        
        // Ignore DMs
        if (!message.guild) {
            console.log('[MESSAGE] Ignoring DM');
            return;
        }
        
        // Prüfen ob Counter Channel
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
        
        const expectedNumber = counter.number + 1;
        const messageContent = message.content.trim();
        
        console.log('[MESSAGE] Expected:', expectedNumber, '| Got:', messageContent);
        
        // Prüfen ob richtige Zahl
        const messageNumber = parseInt(messageContent);
        
        if (isNaN(messageNumber) || messageNumber !== expectedNumber) {
            console.log('[MESSAGE] WRONG NUMBER! RESET COMPLETE COUNTER...');
            
            // ⭐ COUNTER RESET ZURÜCK AUF 0! ⭐
            db.run(
                `UPDATE counters SET number = 0, last_user_id = ?, updated_at = datetime('now'), reset_by = ?, reset_reason = ? 
                 WHERE channel_id = ?`,
                [
                    String(message.author.id),  // Wer hat resettet
                    'Wrong number: ' + messageNumber,  // Warum
                    String(message.channel.id)
                ]
            );
            db.save();
            
            console.log('[MESSAGE] Counter reset to 0');
            
            // Falsche Zahl - DELETE Nachricht
            try {
                await message.delete();
                console.log('[MESSAGE] Message deleted');
            } catch (err) {
                console.log('[MESSAGE] Could not delete message:', err.message);
            }
            
            // ⭐ USER PINGEN IN WARNUNG + RESET NACHRICHT! ⭐
            const warningEmbed = new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('❌ FALSCH! COUNTER GERESETET!')
                .setDescription(
                    `${message.author}, die richtige Zahl war **${expectedNumber}**, nicht ${messageNumber}!\n\n` +
                    `**Counter wurde auf 1 zurückgesetzt!**\n\nNächster darf wieder mit **1** beginnen! 🔥`
                )
                .setFooter({ text: `Reset durch: ${message.author.tag}` })
                .setTimestamp();
            
            const reply = await message.channel.send({ 
                content: `${message.author}`,  // ⭐ PING! ⭐
                embeds: [warningEmbed] 
            });
            console.log('[MESSAGE] Reset warning sent with ping');
            
            // Warnung nach 15 Sekunden löschen (länger wegen wichtigkeit!)
            setTimeout(async () => {
                try { await reply.delete(); } catch (e) {}
            }, 15000);
            return;
        }
        
        // Richtige Zahl! ✓
        const lastUserId = counter.last_user_id;
        const currentUserId = String(message.author.id);
        
        console.log('[MESSAGE] Last User:', lastUserId, '| Current User:', currentUserId);
        
        if (lastUserId && lastUserId === currentUserId) {
            console.log('[MESSAGE] SAME USER AGAIN! RESET COUNTER!');
            
            // ⭐ AUCH HIER RESETEN! ⭐
            db.run(
                `UPDATE counters SET number = 0, last_user_id = ?, updated_at = datetime('now'), reset_by = ?, reset_reason = ? 
                 WHERE channel_id = ?`,
                [
                    String(message.author.id),
                    'Same user twice',
                    String(message.channel.id)
                ]
            );
            db.save();
            
            console.log('[MESSAGE] Counter reset to 0 (same user)');
            
            // Gleicher User - DELETE Nachricht
            try { await message.delete(); } catch (err) {}
            
            // ⭐ USER PINGEN! ⭐
            const warningEmbed = new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('🚫 DU BAST NICHT DRAN! COUNTER GERESETET!')
                .setDescription(
                    `${message.author}, du hast die letzte Zahl gesagt! Ein anderer User muss weiterzählen.\n\n` +
                    `**Counter wurde auf 1 zurückgesetzt!**\n\nNächster darf wieder mit **1** beginnen! 🔥`
                )
                .setTimestamp();
            
            const reply = await message.channel.send({ 
                content: `${message.author}`,  // ⭐ PING! ⭐
                embeds: [warningEmbed] 
            });
            
            setTimeout(async () => {
                try { await reply.delete(); } catch (e) {}
            }, 15000);
            return;
        }
        
        // ALLES RICHTIG! Counter erhöhen
        console.log('[MESSAGE] ✅ SUCCESS! Incrementing counter...');
        db.incrementCounter(channelId, currentUserId);
        
        // React emoji
        try {
            await message.react('✅');
            console.log('[MESSAGE] Reacted with ✅');
        } catch (err) {
            console.log('[MESSAGE] Could not react:', err.message);
        }
        
        // Leaderboard
        try {
            const { updateLeaderboard } = require('../utils/counterHelpers');
            const userTotal = (db.getUserCounterStats?.(currentUserId)?.total_count || 0) + 1;
            updateLeaderboard(currentUserId, message.author.username, userTotal);
            console.log('[MESSAGE] Leaderboard updated');
        } catch (err) {
            console.log('[MESSAGE] Leaderboard update error:', err.message);
        }
        
        // Milestone alle 10 Zahlen
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