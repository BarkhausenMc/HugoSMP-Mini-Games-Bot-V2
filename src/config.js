require('dotenv').config();

const config = {
    // Bot Configuration
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    SERVER_ID: process.env.SERVER_ID,
    
    // Channel & Role IDs
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    STAFF_ROLE_ID: process.env.STAFF_ROLE_ID,
    OWNER_ROLE_ID: process.env.OWNER_ROLE_ID,
    
    // Database
    DATABASE_PATH: process.env.DATABASE_PATH || './data/tickets.db',

       COUNTER_CHANNELS: [
        '1528483781177114766',  // Dein Generell Channel!
        // Weitere Counter-Channels können hier hinzugefügt werden
    ],
    
    // Business Logic
    MAX_ACTIVE_TICKETS_PER_USER: 3,
    INACTIVITY_DAYS: 7,
    TICKET_CATEGORY_NAME: '══╣🚧(WEBSITE) SUPPORT🚧╠══',
    
    // Ticket Categories
    get TICKET_CATEGORIES() {
        return {
            "Genereller Support": {
                emoji: "❓",
                prefix: "gs",
                allowedRoles: [this.STAFF_ROLE_ID],
                questions: [
                    { label: "Wie können wir dir Helfen?", style: "Short", required: true, placeholder: "z.B. Ich kann mich nicht Einloggen" },
                ],
            },
            "User Report": {
                emoji: "⚠️",
                prefix: "ur",
                allowedRoles: [this.STAFF_ROLE_ID],
                questions: [
                    { label: "Wie heißt der User", style: "Short", required: true, placeholder: "Minecraft oder Discord Name" },
                    { label: "Gegen welche Regel hat der User verstoßen?", style: "Paragraph", required: true, placeholder: "z.B. Cheating" },
                    { label: "Welche Beweise hast du?", style: "Short", required: false, placeholder: "z.B. Clip, Foto" },
                ],
            },
            "Bug Report": {
                emoji: "🔧",
                prefix: "bg",
                allowedRoles: [this.OWNER_ROLE_ID],
                questions: [
                    { label: "Was für ein Bug hast du gefunden?", style: "Short", required: true, placeholder: "z.B. Design Problem, Exploit" },
                    { label: "Wie Funktioniert der Bug?", style: "Paragraph", required: true, placeholder: "Beschreibe den Bug" },
                ],
            },
            "Unban Request": {
                emoji: "🔓",
                prefix: "ubr",
                allowedRoles: [this.STAFF_ROLE_ID],
                questions: [
                    { label: "Wie lautet dein Ingame Name?", style: "Short", required: true, placeholder: "z.B. PHOENIX318, lf4kh2 " },
                    { label: "Wieso wurdest du Gebannt?", style: "Short", required: true, placeholder: "z.B. Cheating, Multi Account Abuse" },
                    { label: "Wieso möchtest du Entbannt werden?", style: "Short", required: true, placeholder: "Hier deine Begründung" },
                ],
            },
            "Creator Code": {
                emoji: "⭐",
                prefix: "cc",
                allowedRoles: [this.STAFF_ROLE_ID],
                questions: [
                    { label: "Wie lautet dein Twitch/Youtube Account", style: "Short", required: true, placeholder: "z.B. https://www.twitch.tv/..." },
                    { label: "Wie soll dein Creator Code lauten?", style: "Short", required: true, placeholder: "z.B. yayk, dux, void" },
                ],
            },
            "Rolle": {
                emoji: "👥",
                prefix: "r",
                allowedRoles: [this.STAFF_ROLE_ID],
                questions: [
                    { label: "Welche Rolle möchtest du haben?", style: "Short", required: true, placeholder: "z.B. Dc-Manager, Website Booster, VIP" },
                    { label: "Warum möchtest du diese Rolle haben?", style: "Short", required: true, placeholder: "Hier deine Begründung" },
                    { label: "Welche Rollen hast du auf anderen Dc-Servern?", style: "Short", required: true, placeholder: "z.B. VIP bei yayk Dc" },
                ],
            },
        };
    }
};

// Validate function
config.validate = () => {
    const missing = [];
    if (!process.env.DISCORD_TOKEN) missing.push('DISCORD_TOKEN');
    if (!process.env.SERVER_ID) missing.push('SERVER_ID');
    
    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
    console.log('✅ Config validated successfully');
};

module.exports = config;