/**
 * Neon Syndicate – Vehicle Showroom System (server-side)
 *
 * Events handled:
 *  showroom:open      (internal) – send vehicle catalog for a category
 *  showroom:getModel  (client callRemote) – send single model details
 *  showroom:buy       (client callRemote) – purchase flow
 */

'use strict';

const db = require('../../database/connection');
const { generateVIN, generatePlate } = require('../../utils/generators');
const { takeCash } = require('../character/index');

// ── OPEN SHOWROOM ────────────────────────────────────────────────────────────
// Triggered internally by the interaction system when player presses E near a
// showroom POI.  `category` is one of: car | truck | boat | air
mp.events.add('showroom:open', async (player, category) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const models = await db.queryAll(
            `SELECT id, model_hash, display_name, category, price,
                    has_rear_trunk, has_front_trunk, trunk_capacity,
                    handling_max_vel, handling_acceleration, handling_braking
             FROM vehicle_models
             WHERE category = ?
             ORDER BY price ASC`,
            [category || 'car']
        );

        const charRow = await db.queryOne(
            'SELECT cash FROM characters WHERE cnp = ?',
            [player.data.cnp]
        );

        player.call('showroom:receiveData', [JSON.stringify({
            type:   category || 'car',
            models,
            cash:   charRow ? charRow.cash : 0
        })]);
    } catch (err) {
        console.error(`[SHOWROOM] showroom:open error: ${err.message}`);
        player.call('hud:notification', ['Eroare la deschiderea showroom-ului.', 'error']);
    }
});

// ── GET SINGLE MODEL DETAILS ─────────────────────────────────────────────────
// Client calls this via callRemote to fill in the detail view.
mp.events.add('showroom:getModel', async (player, modelId) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const model = await db.queryOne(
            'SELECT * FROM vehicle_models WHERE id = ?',
            [modelId]
        );
        if (!model) return player.call('hud:notification', ['Model negasit.', 'error']);

        player.call('showroom:receiveModel', [JSON.stringify(model)]);
    } catch (err) {
        console.error(`[SHOWROOM] showroom:getModel error: ${err.message}`);
    }
});

// ── BUY VEHICLE ──────────────────────────────────────────────────────────────
// Client sends: modelId, primaryColor, secondaryColor (optional)
mp.events.add('showroom:buy', async (player, modelId, primaryColor, secondaryColor) => {
    if (!player.data || !player.data.cnp) return;

    try {
        // Fetch model
        const model = await db.queryOne(
            'SELECT * FROM vehicle_models WHERE id = ?',
            [modelId]
        );
        if (!model) return player.call('hud:notification', ['Model negasit.', 'error']);

        // Check funds
        const charRow = await db.queryOne(
            'SELECT cash FROM characters WHERE cnp = ?',
            [player.data.cnp]
        );
        if (!charRow || charRow.cash < model.price) {
            return player.call('hud:notification', ['Bani insuficienti.', 'error']);
        }

        // Generate unique VIN and plate
        const vin   = await generateVIN();
        const plate = generatePlate();

        // Decide which garage type to assign the vehicle to
        const garageTypeMap = {
            truck:       'truck',
            boat:        'boat',
            plane:       'air',
            helicopter:  'air'
        };
        const garageType = garageTypeMap[model.category] || 'car';
        const garageRow  = await db.queryOne(
            'SELECT id, spawn_x, spawn_y, spawn_z, spawn_h FROM garages WHERE garage_type = ? AND is_active = 1 LIMIT 1',
            [garageType]
        );
        const garageId = garageRow ? garageRow.id : null;

        // Persist the vehicle
        await db.insert(
            `INSERT INTO vehicles
                 (vin, model_id, owner_cnp, plate, color_primary, color_secondary, garage_id, fuel)
             VALUES (?,?,?,?,?,?,?,100)`,
            [vin, model.id, player.data.cnp, plate,
             primaryColor   !== undefined ? primaryColor   : 0,
             secondaryColor !== undefined ? secondaryColor : 0,
             garageId]
        );

        // Deduct cash
        const taken = await takeCash(player.data.cnp, model.price);
        if (!taken) {
            // Rollback vehicle row – edge case where cash changed between checks
            await db.update('DELETE FROM vehicles WHERE vin = ?', [vin]);
            return player.call('hud:notification', ['Bani insuficienti.', 'error']);
        }

        // Spawn a preview copy near the player so they can drive it away
        const pos = player.position;
        const spawnPos = garageRow
            ? new mp.Vector3(garageRow.spawn_x, garageRow.spawn_y, garageRow.spawn_z)
            : new mp.Vector3(pos.x + 5, pos.y, pos.z);
        const heading = garageRow ? (garageRow.spawn_h || 270) : 270;

        const veh = mp.vehicles.new(mp.joaat(model.model_hash), spawnPos, {
            heading,
            numberPlate: plate,
            locked:      false,
            engine:      false
        });

        // Tag the live vehicle with VIN so other systems can look it up
        veh.setVariable('vin', vin);

        // Update DB position to the spawn point (not in garage anymore)
        await db.update(
            'UPDATE vehicles SET garage_id = NULL, pos_x = ?, pos_y = ?, pos_z = ?, pos_h = ? WHERE vin = ?',
            [spawnPos.x, spawnPos.y, spawnPos.z, heading, vin]
        );

        // Notify client of success
        player.call('hud:notification', ['Masina cumparata!', 'success']);
        player.call('showroom:purchaseSuccess', [JSON.stringify({ vin, plate })]);

        console.log(`[SHOWROOM] ${player.data.cnp} bought ${model.display_name} VIN:${vin} plate:${plate}`);
    } catch (err) {
        console.error(`[SHOWROOM] showroom:buy error: ${err.message}`);
        player.call('hud:notification', ['Eroare la cumpararea masinii.', 'error']);
    }
});
