require('dotenv').config();

const db = require('./database/connection');

// Safe logger: mp.console may not exist during bootstrap
const log = {
    info:  (msg) => { try { mp.console.logInfo(msg);  } catch { console.log('[INFO] ' + msg);  } },
    warn:  (msg) => { try { mp.console.logWarn(msg);  } catch { console.warn('[WARN] ' + msg);  } },
    error: (msg) => { try { mp.console.logError(msg); } catch { console.error('[ERROR] ' + msg); } }
};

async function bootstrap() {
    try {
        await db.connect();
        log.info('[NS] ==========================================');
        log.info('[NS]  NEON SYNDICATE | BLACKRIDGE CITY');
        log.info('[NS]  Hard Roleplay Server v1.0.0');
        log.info('[NS] ==========================================');

        // Load all systems
        require('./systems/auth/index');
        require('./systems/character/index');
        require('./systems/interaction/index');
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

        log.info('[NS] All systems loaded successfully.');
    } catch (err) {
        log.error('[NS] Bootstrap error: ' + err.message);
        log.error(err.stack);
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
