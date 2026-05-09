require('dotenv').config();

const db = require('./database/connection');

async function bootstrap() {
    try {
        await db.connect();
        mp.console.logInfo('[NS] ==========================================');
        mp.console.logInfo('[NS]  NEON SYNDICATE | BLACKRIDGE CITY');
        mp.console.logInfo('[NS]  Hard Roleplay Server v1.0.0');
        mp.console.logInfo('[NS] ==========================================');

        // Load all systems
        require('./systems/auth/index');
        require('./systems/character/index');
        require('./systems/vehicles/index');
        require('./systems/showroom/index');
        require('./systems/garages/index');
        require('./systems/inventory/index');
        require('./systems/phone/index');
        require('./systems/jobs/index');
        require('./systems/houses/index');
        require('./systems/gangs/index');
        require('./systems/admin/index');
        require('./systems/police/index');
        require('./systems/businesses/index');
        require('./systems/survival/index');
        require('./systems/gym/index');

        mp.console.logInfo('[NS] All systems loaded successfully.');
    } catch (err) {
        mp.console.logError(`[NS] Bootstrap error: ${err.message}`);
        mp.console.logError(err.stack);
    }
}

bootstrap();

// ── GLOBAL CHAT (basic) ───────────────────────────────────────
mp.events.add('playerChat', (player, message) => {
    if (!player.data || !player.data.character) return;
    const char = player.data.character;
    const name = `${char.firstname} ${char.lastname}`;
    mp.players.broadcast(`[CHAT] ${name} (${player.data.cnp}): ${message}`);
});

// ── SERVER INFO COMMAND ───────────────────────────────────────
mp.events.add('playerCommand', (player, command) => {
    const parts = command.trim().split(' ');
    const cmd   = parts[0].toLowerCase();

    switch (cmd) {
        case 'stats':
            if (player.data && player.data.cnp) {
                mp.events.call('character:requestStats', player);
            }
            break;
        case 'inventory':
        case 'inv':
            mp.events.call('inventory:open', player);
            break;
        case 'phone':
            mp.events.call('phone:open', player);
            break;
        case 'job':
            mp.events.call('job:getList', player);
            break;
        case 'gang':
            mp.events.call('gang:getInfo', player);
            break;
    }
});
