/**
 * Neon Syndicate – Garage Management System (server-side)
 *
 * Colshapes are now created by the interaction system (interaction/index.js).
 * This module handles all garage logic: opening UI, spawning / storing vehicles,
 * handling requests, and lock toggling.
 *
 * Events handled (internal / from client):
 *  onResourceStart          – log garage count only (colshapes live in interaction/)
 *  garage:playerInteract    – send garage UI data to player
 *  garage:getVehicles       – re-fetch vehicle list and send to client
 *  vehicle:spawn            – spawn vehicle from garage at spawn point
 *  vehicle:store            – store vehicle back into a garage
 *  vehicle:requestHandling  – send vehicle handling data to client
 *  vehicle:toggleLock       – toggle vehicle locked state
 */

'use strict';

const db = require('../../database/connection');

// Live vehicle registry: vin → mp.Vehicle object
const spawnedVehicles = new Map();

// ── RESOURCE START ────────────────────────────────────────────────────────────
mp.events.add('onResourceStart', async () => {
    try {
        const garages = await db.queryAll('SELECT id, name, garage_type FROM garages WHERE is_active = 1');
        console.log(`[GARAGES] ${garages.length} garages loaded (colshapes managed by interaction system)`);
    } catch (err) {
        console.error(`[GARAGES] onResourceStart error: ${err.message}`);
    }
});

// ── HELPER: resolve which vehicle categories a garage type handles ─────────────
function garageTypeCategories(type) {
    const map = {
        car:   "'car','motorcycle','bicycle'",
        truck: "'truck'",
        boat:  "'boat'",
        air:   "'plane','helicopter'"
    };
    return map[type] || "'car'";
}

// ── GARAGE:PLAYERINTERACT (called by interaction system on E press) ────────────
// `garageData` = { id, name, category }
mp.events.add('garage:playerInteract', async (player, garageData) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const garage = await db.queryOne(
            'SELECT * FROM garages WHERE id = ?',
            [garageData.id]
        );
        if (!garage) return player.call('hud:notification', ['Garaj negasit.', 'error']);

        const categories = garageTypeCategories(garage.garage_type);
        const vehicles   = await db.queryAll(
            `SELECT v.vin, v.plate, v.fuel, v.mileage, v.is_impounded, v.garage_id,
                    vm.display_name, vm.model_hash, vm.category
             FROM vehicles v
             JOIN vehicle_models vm ON vm.id = v.model_id
             WHERE v.owner_cnp = ? AND vm.category IN (${categories})
             ORDER BY vm.display_name`,
            [player.data.cnp]
        );

        // Tag each vehicle with its spawned status so the client can show it
        const vehiclesWithStatus = vehicles.map(v => ({
            ...v,
            isSpawned: spawnedVehicles.has(v.vin)
        }));

        player.call('garage:openUI', [JSON.stringify({
            garage:   { id: garage.id, name: garage.name, type: garage.garage_type },
            vehicles: vehiclesWithStatus
        })]);
    } catch (err) {
        console.error(`[GARAGES] garage:playerInteract error: ${err.message}`);
        player.call('hud:notification', ['Eroare la deschiderea garajului.', 'error']);
    }
});

// ── GARAGE:GETVEHICLES (client refresh) ──────────────────────────────────────
mp.events.add('garage:getVehicles', async (player, garageType) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const categories = garageTypeCategories(garageType || 'car');
        const vehicles   = await db.queryAll(
            `SELECT v.vin, v.plate, v.fuel, v.mileage, v.is_impounded, v.garage_id,
                    vm.display_name, vm.model_hash, vm.category
             FROM vehicles v
             JOIN vehicle_models vm ON vm.id = v.model_id
             WHERE v.owner_cnp = ? AND vm.category IN (${categories})
             ORDER BY vm.display_name`,
            [player.data.cnp]
        );

        const vehiclesWithStatus = vehicles.map(v => ({
            ...v,
            isSpawned: spawnedVehicles.has(v.vin)
        }));

        player.call('garage:receiveVehicles', [JSON.stringify(vehiclesWithStatus)]);
    } catch (err) {
        console.error(`[GARAGES] garage:getVehicles error: ${err.message}`);
    }
});

// ── VEHICLE:SPAWN (from client callRemote) ────────────────────────────────────
mp.events.add('vehicle:spawn', async (player, vin) => {
    if (!player.data || !player.data.cnp) return;

    try {
        // Ownership + data check
        const row = await db.queryOne(
            `SELECT v.*, vm.model_hash, vm.has_rear_trunk, vm.has_front_trunk, vm.trunk_capacity
             FROM vehicles v
             JOIN vehicle_models vm ON vm.id = v.model_id
             WHERE v.vin = ? AND v.owner_cnp = ?`,
            [vin, player.data.cnp]
        );
        if (!row)           return player.call('hud:notification', ['Vehicul negasit sau nu iti apartine.', 'error']);
        if (row.is_impounded) return player.call('hud:notification', ['Vehiculul este sechestrat de politie.', 'error']);
        if (spawnedVehicles.has(vin)) return player.call('hud:notification', ['Vehiculul este deja scos.', 'warning']);

        // Determine spawn position (use garage spawn point if stored in a garage)
        let spawnPos, heading;
        if (row.garage_id) {
            const garage = await db.queryOne(
                'SELECT spawn_x, spawn_y, spawn_z, spawn_h FROM garages WHERE id = ?',
                [row.garage_id]
            );
            if (garage) {
                spawnPos = new mp.Vector3(garage.spawn_x, garage.spawn_y, garage.spawn_z);
                heading  = garage.spawn_h || 0;
            }
        }

        if (!spawnPos) {
            // Fallback: 5 units in front of the player
            const pos = player.position;
            spawnPos  = new mp.Vector3(pos.x + 5, pos.y, pos.z);
            heading   = player.heading;
        }

        // Create the vehicle entity
        const vehicle = mp.vehicles.new(mp.joaat(row.model_hash), spawnPos, {
            heading,
            numberPlate: row.plate,
            alpha:       255,
            locked:      false,
            engine:      false
        });

        vehicle.data = {
            vin,
            ownerCnp:   row.owner_cnp,
            trunkOpen:  false
        };
        vehicle.fuel    = row.fuel    || 100;
        vehicle.mileage = row.mileage || 0;

        spawnedVehicles.set(vin, vehicle);

        // Mark vehicle as no longer in a garage
        await db.update(
            'UPDATE vehicles SET garage_id = NULL, pos_x = ?, pos_y = ?, pos_z = ?, pos_h = ? WHERE vin = ?',
            [spawnPos.x, spawnPos.y, spawnPos.z, heading, vin]
        );

        player.call('garage:vehicleSpawned', [vin]);
        player.call('hud:notification', [`Vehiculul ${row.plate} a fost scos din garaj.`, 'success']);
        console.log(`[GARAGES] ${player.data.cnp} spawned VIN:${vin}`);
    } catch (err) {
        console.error(`[GARAGES] vehicle:spawn error: ${err.message}`);
        player.call('hud:notification', ['Eroare la scoaterea vehiculului.', 'error']);
    }
});

// ── VEHICLE:STORE (from client callRemote) ────────────────────────────────────
// args: vin, garageId (optional – if not supplied we find the nearest active garage)
mp.events.add('vehicle:store', async (player, vin, garageId) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const veh = spawnedVehicles.get(vin);
        if (!veh) return player.call('hud:notification', ['Vehiculul nu este spawnat.', 'error']);

        // Verify ownership
        const row = await db.queryOne('SELECT owner_cnp FROM vehicles WHERE vin = ?', [vin]);
        if (!row || row.owner_cnp !== player.data.cnp) {
            return player.call('hud:notification', ['Nu esti proprietarul acestui vehicul.', 'error']);
        }

        // If no garageId supplied, find nearest active garage
        if (!garageId) {
            const pos      = player.position;
            const garages  = await db.queryAll('SELECT id, pos_x, pos_y, pos_z FROM garages WHERE is_active = 1');
            let bestId     = null;
            let bestDist   = Infinity;
            for (const g of garages) {
                const d = Math.sqrt(
                    Math.pow(pos.x - g.pos_x, 2) +
                    Math.pow(pos.y - g.pos_y, 2) +
                    Math.pow(pos.z - g.pos_z, 2)
                );
                if (d < bestDist) { bestDist = d; bestId = g.id; }
            }
            if (!bestId || bestDist > 20) {
                return player.call('hud:notification', ['Nu esti langa niciun garaj.', 'error']);
            }
            garageId = bestId;
        }

        // Save current position + fuel before destroying
        const vehPos = veh.position;
        const fuel   = veh.fuel || 100;

        await db.update(
            'UPDATE vehicles SET garage_id = ?, pos_x = ?, pos_y = ?, pos_z = ?, fuel = ? WHERE vin = ?',
            [garageId, vehPos.x, vehPos.y, vehPos.z, fuel, vin]
        );

        // Destroy the entity
        veh.destroy();
        spawnedVehicles.delete(vin);

        player.call('hud:notification', ['Masina depozitata!', 'success']);
        player.call('garage:vehicleStored', []);
        console.log(`[GARAGES] ${player.data.cnp} stored VIN:${vin} in garage #${garageId}`);
    } catch (err) {
        console.error(`[GARAGES] vehicle:store error: ${err.message}`);
        player.call('hud:notification', ['Eroare la depozitarea vehiculului.', 'error']);
    }
});

// ── VEHICLE:REQUESTHANDLING (from client) ────────────────────────────────────
mp.events.add('vehicle:requestHandling', async (player, vin) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const row = await db.queryOne(
            `SELECT vm.handling_mass, vm.handling_initial_drag, vm.handling_max_vel,
                    vm.handling_acceleration, vm.handling_braking,
                    vm.handling_traction_curve_max, vm.handling_extra
             FROM vehicles v
             JOIN vehicle_models vm ON vm.id = v.model_id
             WHERE v.vin = ?`,
            [vin]
        );
        if (!row) return;

        player.call('vehicle:applyHandling', [vin, JSON.stringify({
            mass:             row.handling_mass,
            initialDragCoeff: row.handling_initial_drag,
            maxVelocity:      row.handling_max_vel,
            acceleration:     row.handling_acceleration,
            brakeForce:       row.handling_braking,
            tractionCurveMax: row.handling_traction_curve_max,
            extra:            row.handling_extra
        })]);
    } catch (err) {
        console.error(`[GARAGES] vehicle:requestHandling error: ${err.message}`);
    }
});

// ── VEHICLE:TOGGLELOCK (from client) ─────────────────────────────────────────
mp.events.add('vehicle:toggleLock', async (player, vin) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const veh = spawnedVehicles.get(vin);
        if (!veh) return player.call('hud:notification', ['Vehiculul nu este spawnat.', 'error']);

        const row = await db.queryOne('SELECT owner_cnp FROM vehicles WHERE vin = ?', [vin]);
        if (!row || row.owner_cnp !== player.data.cnp) {
            return player.call('hud:notification', ['Nu esti proprietarul.', 'error']);
        }

        veh.locked = !veh.locked;
        const state = veh.locked ? 'blocat' : 'deblocat';
        player.call('hud:notification', [`Vehicul ${state}.`, 'info']);

        // Broadcast the lock state to nearby players (so they can't enter)
        mp.players.toArray().forEach(p => {
            if (!p.data) return;
            const d = p.position.distanceTo(player.position);
            if (d < 50) p.call('vehicle:lockState', [vin, veh.locked]);
        });
    } catch (err) {
        console.error(`[GARAGES] vehicle:toggleLock error: ${err.message}`);
    }
});

// ── FUEL DRAIN TICK (every 2 minutes) ────────────────────────────────────────
setInterval(() => {
    spawnedVehicles.forEach(async (veh, vin) => {
        try {
            if (!veh || !mp.vehicles.exists(veh)) {
                spawnedVehicles.delete(vin);
                return;
            }
            const engineOn = veh.getVariable('engineOn');
            if (engineOn && veh.fuel > 0) {
                veh.fuel = Math.max(0, (veh.fuel || 100) - 1.5);
                await db.update('UPDATE vehicles SET fuel = ? WHERE vin = ?', [veh.fuel, vin]);
            }
        } catch { /* silent – vehicle may have been destroyed */ }
    });
}, 120000);

// ── PERIODIC POSITION SAVE (every 60s) ───────────────────────────────────────
setInterval(async () => {
    for (const [vin, veh] of spawnedVehicles) {
        try {
            if (!veh || !mp.vehicles.exists(veh)) {
                spawnedVehicles.delete(vin);
                continue;
            }
            const pos = veh.position;
            await db.update(
                'UPDATE vehicles SET pos_x = ?, pos_y = ?, pos_z = ? WHERE vin = ?',
                [pos.x, pos.y, pos.z, vin]
            );
        } catch { /* silent */ }
    }
}, 60000);

module.exports = { spawnedVehicles };
