const db = require('../../database/connection');

const GYM_MAX_KG     = 10.0;  // user requested max 10kg
const GYM_START_KG   = 4.0;   // user requested start 4kg
const NO_PROTEIN_GAIN = 0.002; // kg per session without protein bar
const PROTEIN_MULT    = 1.5;   // multiplier with protein bar

// Gym locations (colshapes)
const GYM_POSITIONS = [
    { x: -1193.8, y: -1565.7, z: 4.6,  name: 'Musclemax Gym',    type: 'gym'  },
    { x: -1211.0, y: -403.7,  z: 38.0, name: 'Downtown Fitness', type: 'gym'  },
    { x: -623.2,  y: -1660.0, z: 22.0, name: 'Blackridge Pool',  type: 'pool' }
];

mp.events.add('onResourceStart', () => {
    GYM_POSITIONS.forEach(g => {
        const col = mp.colshapes.newSphere(new mp.Vector3(g.x, g.y, g.z), 5.0);
        col.gymData = g;
    });
    mp.console.logInfo('[GYM] Loaded gym locations');
});

mp.events.add('playerEnterColshape', (player, colshape) => {
    if (!colshape.gymData || !player.data || !player.data.cnp) return;
    player.call('gym:showMenu', [JSON.stringify(colshape.gymData)]);
});

mp.events.add('playerExitColshape', (player, colshape) => {
    if (!colshape.gymData) return;
    player.call('gym:closeMenu');
});

// ── START EXERCISE ────────────────────────────────────────────
mp.events.add('gym:startExercise', async (player, exerciseType, durationMin) => {
    if (!player.data || !player.data.cnp) return;

    durationMin = Math.max(1, Math.min(60, parseInt(durationMin) || 5));

    const char = await db.queryOne(
        'SELECT id, carry_base, carry_gym, stamina FROM characters WHERE cnp = ?',
        [player.data.cnp]
    );
    if (!char) return;

    const currentTotal = (char.carry_base || GYM_START_KG) + (char.carry_gym || 0.0);
    if (currentTotal >= GYM_MAX_KG) {
        return player.call('hud:notification', ['Ai atins capacitatea maxima de 10kg!', 'warning']);
    }

    // Check if player has protein bar equipped
    const hasProtein = await db.queryOne(
        'SELECT id FROM character_inventory WHERE character_id = ? AND item_name = ? AND quantity > 0',
        [char.id, 'protein_bar']
    );

    let gainPerMin = NO_PROTEIN_GAIN;
    let usedProtein = false;

    if (hasProtein) {
        gainPerMin  = NO_PROTEIN_GAIN * PROTEIN_MULT;
        usedProtein = true;
        // Consume one protein bar
        await db.update(
            'UPDATE character_inventory SET quantity = quantity - 1 WHERE character_id = ? AND item_name = ? AND quantity > 0 LIMIT 1',
            [char.id, 'protein_bar']
        );
        await db.update('DELETE FROM character_inventory WHERE character_id = ? AND quantity <= 0', [char.id]);
    }

    const kgGained = Math.min(gainPerMin * durationMin, GYM_MAX_KG - currentTotal);

    // Additional effects per exercise type
    const effects = {
        bench_press:    { statField: null,    kgMult: 1.2, staminaDrain: 10 },
        squats:         { statField: null,    kgMult: 1.0, staminaDrain: 8  },
        treadmill:      { statField: null,    kgMult: 0.5, staminaDrain: 15 },
        boxing:         { statField: null,    kgMult: 1.0, staminaDrain: 12 },
        swimming:       { statField: null,    kgMult: 0.3, staminaDrain: 6  }
    };

    const ex        = effects[exerciseType] || effects.bench_press;
    const finalGain = kgGained * ex.kgMult;
    const newGymKg  = Math.min(char.carry_gym + finalGain, GYM_MAX_KG - GYM_START_KG);

    await db.update(
        'UPDATE characters SET carry_gym = ?, stamina = GREATEST(0, stamina - ?) WHERE cnp = ?',
        [newGymKg, ex.staminaDrain, player.data.cnp]
    );

    // Log session
    await db.insert(
        'INSERT INTO gym_sessions (character_cnp, exercise_type, duration_min, kg_gained, used_protein) VALUES (?,?,?,?,?)',
        [player.data.cnp, exerciseType, durationMin, finalGain, usedProtein ? 1 : 0]
    );

    const newTotal = GYM_START_KG + newGymKg;
    player.call('gym:exerciseComplete', [JSON.stringify({
        exerciseType,
        kgGained:    parseFloat(finalGain.toFixed(4)),
        totalCapacity: parseFloat(newTotal.toFixed(2)),
        maxCapacity:   GYM_MAX_KG,
        usedProtein
    })]);
    player.call('hud:notification', [
        `Antrenament ${exerciseType}: +${finalGain.toFixed(3)}kg capacitate. Total: ${newTotal.toFixed(2)}/${GYM_MAX_KG}kg`,
        'success'
    ]);
});

// ── GET GYM STATS ─────────────────────────────────────────────
mp.events.add('gym:getStats', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne(
        'SELECT carry_base, carry_gym, stamina FROM characters WHERE cnp = ?',
        [player.data.cnp]
    );
    if (!char) return;
    const total = (char.carry_base || GYM_START_KG) + (char.carry_gym || 0);
    player.call('gym:receiveStats', [JSON.stringify({
        carryBase:  char.carry_base || GYM_START_KG,
        carryGym:   char.carry_gym  || 0,
        totalCarry: parseFloat(total.toFixed(2)),
        maxCarry:   GYM_MAX_KG,
        stamina:    char.stamina
    })]);
});
