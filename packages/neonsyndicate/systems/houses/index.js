const db = require('../../database/connection');
const { takeCash } = require('../character/index');

// Interior teleport offsets indexed by interior_id
const INTERIORS = [
    { x: 265.8,  y: 215.7,  z: 102.5 },  // 0 - basic apartment
    { x: -786.4, y: 315.6,  z: 217.6 },  // 1 - mid apartment
    { x: -46.5,  y: -592.3, z: 81.5  },  // 2 - luxury apartment
    { x: 346.1,  y: 344.4,  z: 103.1 },  // 3 - house
];

mp.events.add('onResourceStart', async () => {
    const houses = await db.queryAll('SELECT * FROM houses');
    for (const house of houses) {
        const col = mp.colshapes.newSphere(new mp.Vector3(house.pos_x, house.pos_y, house.pos_z), 2.0);
        col.houseId   = house.id;
        col.houseData = house;
    }
    console.log(`[HOUSES] Loaded ${houses.length} houses`);
});

mp.events.add('playerEnterColshape', (player, colshape) => {
    if (!colshape.houseId) return;
    if (!player.data || !player.data.cnp) return;
    const house = colshape.houseData;
    player.call('house:showMenu', [JSON.stringify({
        id:       house.id,
        address:  house.address,
        price:    house.price,
        forSale:  house.for_sale,
        isOwner:  house.owner_cnp === player.data.cnp,
        isLocked: house.is_locked
    })]);
});

// ── ENTER HOUSE ───────────────────────────────────────────────
mp.events.add('house:enter', async (player, houseId) => {
    if (!player.data || !player.data.cnp) return;
    const house = await db.queryOne('SELECT * FROM houses WHERE id = ?', [houseId]);
    if (!house) return;

    if (house.is_locked && house.owner_cnp !== player.data.cnp) {
        return player.call('hud:notification', ['Casa este incuiata.', 'error']);
    }

    const interior = INTERIORS[house.interior_id] || INTERIORS[0];
    player.dimension = houseId + 1000;
    player.position  = new mp.Vector3(interior.x, interior.y, interior.z);
    player.data.inHouse = houseId;
    player.call('hud:notification', [`Ai intrat in ${house.address}`, 'info']);
});

// ── EXIT HOUSE ────────────────────────────────────────────────
mp.events.add('house:exit', async (player) => {
    if (!player.data || !player.data.inHouse) return;
    const houseId = player.data.inHouse;
    const house   = await db.queryOne('SELECT pos_x, pos_y, pos_z FROM houses WHERE id = ?', [houseId]);
    if (!house) return;

    player.dimension  = 0;
    player.position   = new mp.Vector3(house.pos_x, house.pos_y, house.pos_z + 0.5);
    delete player.data.inHouse;
});

// ── BUY HOUSE ─────────────────────────────────────────────────
mp.events.add('house:buy', async (player, houseId) => {
    if (!player.data || !player.data.cnp) return;
    const house = await db.queryOne('SELECT * FROM houses WHERE id = ?', [houseId]);
    if (!house || !house.for_sale) return player.call('hud:notification', ['Casa nu este de vanzare.', 'error']);
    if (house.owner_cnp) return player.call('hud:notification', ['Casa are deja un proprietar.', 'error']);

    const taken = await takeCash(player.data.cnp, house.price);
    if (!taken) return player.call('hud:notification', ['Bani insuficienti.', 'error']);

    await db.update('UPDATE houses SET owner_cnp = ?, for_sale = 0 WHERE id = ?', [player.data.cnp, houseId]);
    player.call('hud:notification', [`Ai cumparat ${house.address}!`, 'success']);
});

// ── TOGGLE LOCK ───────────────────────────────────────────────
mp.events.add('house:toggleLock', async (player, houseId) => {
    if (!player.data || !player.data.cnp) return;
    const house = await db.queryOne('SELECT owner_cnp, is_locked FROM houses WHERE id = ?', [houseId]);
    if (!house || house.owner_cnp !== player.data.cnp) return;
    const locked = house.is_locked ? 0 : 1;
    await db.update('UPDATE houses SET is_locked = ? WHERE id = ?', [locked, houseId]);
    player.call('hud:notification', [locked ? 'Casa incuiata.' : 'Casa deschisa.', 'info']);
});
