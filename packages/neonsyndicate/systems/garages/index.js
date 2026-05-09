const db = require('../../database/connection');

// Load all garages and create server-side markers/blips
mp.events.add('onResourceStart', async () => {
    const garages = await db.queryAll('SELECT * FROM garages WHERE is_active = 1');
    for (const g of garages) {
        const col = mp.colshapes.newSphere(new mp.Vector3(g.pos_x, g.pos_y, g.pos_z), 3.0);
        col.garageId   = g.id;
        col.garageType = g.garage_type;
        col.garageName = g.name;
    }
    mp.console.logInfo(`[GARAGES] Loaded ${garages.length} garages`);
});

// Player enters garage colshape
mp.events.add('playerEnterColshape', (player, colshape) => {
    if (!colshape.garageId) return;
    if (!player.data || !player.data.cnp) return;
    player.call('garage:showMenu', [JSON.stringify({
        id:   colshape.garageId,
        name: colshape.garageName,
        type: colshape.garageType
    })]);
});

mp.events.add('playerExitColshape', (player, colshape) => {
    if (!colshape.garageId) return;
    player.call('garage:closeMenu');
});

// Get player vehicles for this garage type
mp.events.add('garage:getVehicles', async (player, garageType) => {
    if (!player.data || !player.data.cnp) return;

    const vehicles = await db.queryAll(
        `SELECT v.vin, v.plate, v.fuel, v.mileage, v.is_impounded, v.garage_id,
                vm.display_name, vm.model_hash, vm.category
         FROM vehicles v
         JOIN vehicle_models vm ON vm.id = v.model_id
         WHERE v.owner_cnp = ? AND vm.category IN (${garageTypeCategories(garageType)})
         ORDER BY vm.display_name`,
        [player.data.cnp]
    );
    player.call('garage:receiveVehicles', [JSON.stringify(vehicles)]);
});

function garageTypeCategories(type) {
    const map = {
        car:   "'car','motorcycle','bicycle'",
        truck: "'truck'",
        boat:  "'boat'",
        air:   "'plane','helicopter'"
    };
    return map[type] || "'car'";
}
