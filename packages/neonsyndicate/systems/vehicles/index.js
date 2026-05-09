const db = require('../../database/connection');
const { generateVIN, generatePlate } = require('../../utils/generators');
const { takeCash } = require('../character/index');

// Map of spawned vehicles: vin -> mp.Vehicle
const spawnedVehicles = new Map();

// ── APPLY HANDLING ────────────────────────────────────────────
// Called client-side after vehicle is streamed in
mp.events.add('vehicle:requestHandling', async (player, vin) => {
    const veh = await db.queryOne(
        `SELECT vm.handling_mass, vm.handling_initial_drag, vm.handling_max_vel,
                vm.handling_acceleration, vm.handling_braking,
                vm.handling_traction_curve_max, vm.handling_extra
         FROM vehicles v
         JOIN vehicle_models vm ON vm.id = v.model_id
         WHERE v.vin = ?`, [vin]
    );
    if (!veh) return;
    const data = {
        mass:               veh.handling_mass,
        initialDragCoeff:   veh.handling_initial_drag,
        maxVelocity:        veh.handling_max_vel,
        acceleration:       veh.handling_acceleration,
        brakeForce:         veh.handling_braking,
        tractionCurveMax:   veh.handling_traction_curve_max,
        extra:              veh.handling_extra
    };
    player.call('vehicle:applyHandling', [vin, JSON.stringify(data)]);
});

// ── SPAWN VEHICLE FROM GARAGE ─────────────────────────────────
mp.events.add('vehicle:spawn', async (player, vin) => {
    if (!player.data || !player.data.cnp) return;

    const row = await db.queryOne(
        `SELECT v.*, vm.model_hash, vm.has_rear_trunk, vm.has_front_trunk, vm.trunk_capacity
         FROM vehicles v
         JOIN vehicle_models vm ON vm.id = v.model_id
         WHERE v.vin = ? AND v.owner_cnp = ?`,
        [vin, player.data.cnp]
    );
    if (!row) return player.call('hud:notification', ['Vehicul negasit.', 'error']);
    if (row.is_impounded) return player.call('hud:notification', ['Vehiculul este sechestrat.', 'error']);
    if (spawnedVehicles.has(vin)) return player.call('hud:notification', ['Vehiculul este deja scos.', 'warning']);

    const garage = await db.queryOne('SELECT spawn_x, spawn_y, spawn_z, spawn_h FROM garages WHERE id = ?', [row.garage_id]);
    const spawnPos = garage
        ? new mp.Vector3(garage.spawn_x, garage.spawn_y, garage.spawn_z)
        : new mp.Vector3(player.position.x + 5, player.position.y, player.position.z);
    const heading = garage ? garage.spawn_h : 0;

    const vehicle = mp.vehicles.new(mp.joaat(row.model_hash), spawnPos, {
        heading,
        numberPlate: row.plate,
        alpha:       255,
        color:       [row.color_primary, row.color_secondary],
        locked:      false,
        engine:      false
    });

    vehicle.data        = { vin, ownerCnp: row.owner_cnp, trunkOpen: false };
    vehicle.fuel        = row.fuel;
    vehicle.mileage     = row.mileage;

    spawnedVehicles.set(vin, vehicle);
    await db.update('UPDATE vehicles SET garage_id = NULL, pos_x=?, pos_y=?, pos_z=?, pos_h=? WHERE vin=?',
        [spawnPos.x, spawnPos.y, spawnPos.z, heading, vin]);

    player.call('hud:notification', [`Vehiculul ${row.plate} a fost scos.`, 'success']);
});

// ── STORE VEHICLE IN GARAGE ───────────────────────────────────
mp.events.add('vehicle:store', async (player, vin, garageId) => {
    if (!player.data || !player.data.cnp) return;

    const veh = spawnedVehicles.get(vin);
    if (!veh) return player.call('hud:notification', ['Vehiculul nu este spawnat.', 'error']);

    const row = await db.queryOne('SELECT owner_cnp FROM vehicles WHERE vin = ?', [vin]);
    if (!row || row.owner_cnp !== player.data.cnp) return player.call('hud:notification', ['Nu esti proprietarul.', 'error']);

    const pos = veh.position;
    await db.update('UPDATE vehicles SET garage_id = ?, pos_x=?, pos_y=?, pos_z=?, fuel=? WHERE vin=?',
        [garageId, pos.x, pos.y, pos.z, veh.fuel || 100, vin]);
    veh.destroy();
    spawnedVehicles.delete(vin);
    player.call('hud:notification', ['Vehiculul a fost parcat.', 'success']);
});

// ── BUY VEHICLE (from showroom) ───────────────────────────────
mp.events.add('showroom:buy', async (player, modelId, primaryColor, secondaryColor) => {
    if (!player.data || !player.data.cnp) return;

    const model = await db.queryOne('SELECT * FROM vehicle_models WHERE id = ?', [modelId]);
    if (!model) return player.call('hud:notification', ['Model negasit.', 'error']);

    const taken = await takeCash(player.data.cnp, model.price);
    if (!taken) return player.call('hud:notification', ['Bani insuficienti.', 'error']);

    const vin   = await generateVIN();
    const plate = generatePlate();

    // Assign to first garage of matching type
    const category = model.category;
    const garageType = ['truck'].includes(category) ? 'truck'
        : ['boat'].includes(category) ? 'boat'
        : ['plane','helicopter'].includes(category) ? 'air'
        : 'car';

    const garage = await db.queryOne('SELECT id FROM garages WHERE garage_type = ? LIMIT 1', [garageType]);
    const garageId = garage ? garage.id : null;

    await db.insert(
        `INSERT INTO vehicles (vin, model_id, owner_cnp, plate, color_primary, color_secondary, garage_id)
         VALUES (?,?,?,?,?,?,?)`,
        [vin, modelId, player.data.cnp, plate, primaryColor || 0, secondaryColor || 0, garageId]
    );

    await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [model.price, player.data.cnp]);

    player.call('showroom:close');
    player.call('hud:notification', [`Ai cumparat ${model.display_name}! VIN: ${vin}`, 'success']);
});

// ── GET PLAYER VEHICLES ───────────────────────────────────────
mp.events.add('vehicle:getList', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const vehicles = await db.queryAll(
        `SELECT v.vin, v.plate, v.fuel, v.mileage, v.garage_id, v.is_impounded,
                vm.display_name, vm.category, vm.model_hash
         FROM vehicles v
         JOIN vehicle_models vm ON vm.id = v.model_id
         WHERE v.owner_cnp = ?`, [player.data.cnp]
    );
    player.call('vehicle:receiveList', [JSON.stringify(vehicles)]);
});

// ── OPEN TRUNK ────────────────────────────────────────────────
mp.events.add('vehicle:openTrunk', async (player, vin) => {
    const veh = spawnedVehicles.get(vin);
    if (!veh) return;

    const row = await db.queryOne(
        `SELECT v.trunk_items, v.front_trunk_items, vm.has_rear_trunk, vm.has_front_trunk, vm.trunk_capacity
         FROM vehicles v JOIN vehicle_models vm ON vm.id = v.model_id WHERE v.vin = ?`, [vin]
    );
    if (!row) return;

    player.call('inventory:openTrunk', [vin, JSON.stringify({
        rearItems:   row.trunk_items       || [],
        frontItems:  row.front_trunk_items || [],
        hasRear:     row.has_rear_trunk,
        hasFront:    row.has_front_trunk,
        capacity:    row.trunk_capacity
    })]);
});

// ── SAVE TRUNK ────────────────────────────────────────────────
mp.events.add('vehicle:saveTrunk', async (player, vin, rearJSON, frontJSON) => {
    await db.update('UPDATE vehicles SET trunk_items = ?, front_trunk_items = ? WHERE vin = ?',
        [rearJSON, frontJSON, vin]);
});

// ── LOCK / UNLOCK ─────────────────────────────────────────────
mp.events.add('vehicle:toggleLock', async (player, vin) => {
    const veh = spawnedVehicles.get(vin);
    if (!veh) return;
    const row = await db.queryOne('SELECT owner_cnp FROM vehicles WHERE vin = ?', [vin]);
    if (!row || row.owner_cnp !== player.data.cnp) return;
    veh.locked = !veh.locked;
    player.call('hud:notification', [veh.locked ? 'Vehicul blocat.' : 'Vehicul deblocat.', 'info']);
});

// ── FUEL DRAIN (every 2 minutes) ─────────────────────────────
setInterval(() => {
    spawnedVehicles.forEach(async (veh, vin) => {
        if (!veh || !mp.vehicles.exists(veh)) {
            spawnedVehicles.delete(vin);
            return;
        }
        if (veh.fuel > 0 && veh.getVariable('engineOn')) {
            veh.fuel = Math.max(0, (veh.fuel || 100) - 1.5);
            await db.update('UPDATE vehicles SET fuel = ? WHERE vin = ?', [veh.fuel, vin]);
        }
    });
}, 120000);

module.exports = { spawnedVehicles };
