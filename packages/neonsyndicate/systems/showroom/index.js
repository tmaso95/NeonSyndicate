const db = require('../../database/connection');

// Marker positions for each showroom type
const SHOWROOM_MARKERS = {
    car:   { x: -49.5,   y: -1097.2, z: 26.4 },
    truck: { x: -451.7,  y: -1600.3, z: 15.5 },
    boat:  { x: -782.4,  y: -1475.8, z: 0.4  },
    air:   { x: -1069.3, y: -2658.6, z: 13.8 }
};

// Send showroom catalog to client
mp.events.add('showroom:open', async (player, garageType) => {
    if (!player.data || !player.data.cnp) return;

    const models = await db.queryAll(
        `SELECT id, model_hash, display_name, category, price,
                has_rear_trunk, has_front_trunk, trunk_capacity,
                handling_max_vel, handling_acceleration, handling_braking
         FROM vehicle_models WHERE category = ? ORDER BY price ASC`,
        [garageType || 'car']
    );

    const cash = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [player.data.cnp]);

    player.call('showroom:receiveData', [JSON.stringify({
        type:   garageType || 'car',
        models,
        cash:   cash ? cash.cash : 0
    })]);
});

// Get single model details
mp.events.add('showroom:getModel', async (player, modelId) => {
    const model = await db.queryOne('SELECT * FROM vehicle_models WHERE id = ?', [modelId]);
    if (model) player.call('showroom:receiveModel', [JSON.stringify(model)]);
});
