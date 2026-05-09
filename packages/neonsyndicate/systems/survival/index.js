const db = require('../../database/connection');

// Survival tick every 5 real minutes
const TICK_INTERVAL = 5 * 60 * 1000;

// How much stats drop per tick
const HUNGER_DRAIN  = 3;
const THIRST_DRAIN  = 5;
const STAMINA_DRAIN = 2;

setInterval(async () => {
    const players = mp.players.toArray();
    for (const player of players) {
        if (!player.data || !player.data.cnp) continue;

        try {
            const char = await db.queryOne(
                'SELECT hunger, thirst, stamina, stress, health FROM characters WHERE cnp = ?',
                [player.data.cnp]
            );
            if (!char) continue;

            let hunger  = Math.max(0, char.hunger  - HUNGER_DRAIN);
            let thirst  = Math.max(0, char.thirst  - THIRST_DRAIN);
            let stamina = Math.max(0, char.stamina  - STAMINA_DRAIN);
            let stress  = char.stress;
            let hpPenalty = 0;

            // Effects of low stats
            if (hunger  < 20) hpPenalty += 5;
            if (thirst  < 10) hpPenalty += 8;
            if (stamina < 10) stress = Math.min(100, stress + 5);

            if (hpPenalty > 0 && player.health > 105) {
                player.health = Math.max(105, player.health - hpPenalty);
            }

            await db.update(
                'UPDATE characters SET hunger = ?, thirst = ?, stamina = ?, stress = ? WHERE cnp = ?',
                [hunger, thirst, stamina, stress, player.data.cnp]
            );

            // Push to client HUD
            player.call('survival:updateStats', [JSON.stringify({ hunger, thirst, stamina, stress })]);

            // Warnings
            if (hunger  === 0) player.call('hud:notification', ['Esti infometat! Mananca ceva urgent.', 'error']);
            if (thirst  === 0) player.call('hud:notification', ['Esti deshidratat! Bea ceva urgent.', 'error']);
            if (stress >= 80)  player.call('hud:notification', ['Nivel de stres critic! Odihneste-te.', 'warning']);
        } catch { /* silent */ }
    }
}, TICK_INTERVAL);

// ── EAT FOOD ─────────────────────────────────────────────────
mp.events.add('survival:eat', async (player, itemName) => {
    if (!player.data || !player.data.cnp) return;

    const effects = {
        sandwich:       { hunger: 40, thirst: 5,  stamina: 5,  stress: -5  },
        water_bottle_l: { hunger: 0,  thirst: 30, stamina: 10, stress: -3  },
        energy_drink:   { hunger: 5,  thirst: -5, stamina: 20, stress: -10 },
        water:          { hunger: 0,  thirst: 25, stamina: 5,  stress: 0   },
        protein_bar:    { hunger: 15, thirst: -5, stamina: 30, stress: -5  }
    };

    const effect = effects[itemName];
    if (!effect) return;

    await db.update(`
        UPDATE characters SET
            hunger  = LEAST(100, GREATEST(0, hunger  + ?)),
            thirst  = LEAST(100, GREATEST(0, thirst  + ?)),
            stamina = LEAST(100, GREATEST(0, stamina + ?)),
            stress  = LEAST(100, GREATEST(0, stress  + ?))
        WHERE cnp = ?`,
        [effect.hunger, effect.thirst, effect.stamina, effect.stress, player.data.cnp]
    );

    const updated = await db.queryOne('SELECT hunger, thirst, stamina, stress FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (updated) player.call('survival:updateStats', [JSON.stringify(updated)]);
});

// ── REQUEST CURRENT STATS ─────────────────────────────────────
mp.events.add('survival:requestStats', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT hunger, thirst, stamina, stress FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (char) player.call('survival:updateStats', [JSON.stringify(char)]);
});
