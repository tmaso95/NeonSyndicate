const db = require('../../database/connection');

// ── WEIGHT HELPERS ─────────────────────────────────────────────
async function getCurrentWeight(charId) {
    const rows = await db.queryAll(
        `SELECT ci.quantity, i.weight FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ?`, [charId]
    );
    return rows.reduce((sum, r) => sum + (r.weight || 0.1) * (r.quantity || 1), 0);
}

async function getMaxCarry(charId) {
    const char = await db.queryOne('SELECT carry_base, carry_gym FROM characters WHERE id = ?', [charId]);
    if (!char) return 4.0;

    let base = (char.carry_base || 4.0) + (char.carry_gym || 0.0);

    // Check if a bag is equipped in bag slot
    const bagSlot = await db.queryOne(
        `SELECT ci.item_name, i.bag_capacity FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ? AND ci.slot_index = -1`,
        [charId]
    );
    if (bagSlot && bagSlot.bag_capacity > 0) {
        base += bagSlot.bag_capacity;
    }

    return parseFloat(base.toFixed(2));
}

// ── GIVE ITEM (server utility) ────────────────────────────────
async function giveItem(charId, itemName, quantity, metadata = null) {
    const item = await db.queryOne('SELECT * FROM items WHERE name = ?', [itemName]);
    if (!item) return false;

    // Weight check
    const currentWeight = await getCurrentWeight(charId);
    const maxCarry      = await getMaxCarry(charId);
    const addedWeight   = (item.weight || 0.1) * quantity;

    if (currentWeight + addedWeight > maxCarry) return false;

    // Stack on existing
    const existing = await db.queryOne(
        'SELECT id, quantity FROM character_inventory WHERE character_id = ? AND item_name = ? AND slot_index >= 0',
        [charId, itemName]
    );

    if (existing && existing.quantity + quantity <= (item.max_stack || 99)) {
        await db.update('UPDATE character_inventory SET quantity = quantity + ? WHERE id = ?',
            [quantity, existing.id]);
        return true;
    }

    // New slot (use next available non-negative index)
    const usedSlots = await db.queryAll(
        'SELECT slot_index FROM character_inventory WHERE character_id = ? AND slot_index >= 0', [charId]
    );
    const usedSet = new Set(usedSlots.map(r => r.slot_index));
    let freeSlot  = -2;
    for (let i = 0; i < 200; i++) {
        if (!usedSet.has(i)) { freeSlot = i; break; }
    }
    if (freeSlot < 0) return false;

    await db.insert(
        'INSERT INTO character_inventory (character_id, item_name, quantity, slot_index, metadata) VALUES (?,?,?,?,?)',
        [charId, itemName, quantity, freeSlot, metadata ? JSON.stringify(metadata) : null]
    );
    return true;
}

async function consumeItem(charId, slotIndex, amount) {
    const slot = await db.queryOne(
        'SELECT quantity FROM character_inventory WHERE character_id = ? AND slot_index = ?',
        [charId, slotIndex]
    );
    if (!slot) return;
    if (slot.quantity <= amount) {
        await db.update('DELETE FROM character_inventory WHERE character_id = ? AND slot_index = ?', [charId, slotIndex]);
    } else {
        await db.update('UPDATE character_inventory SET quantity = quantity - ? WHERE character_id = ? AND slot_index = ?',
            [amount, charId, slotIndex]);
    }
}

// ── OPEN INVENTORY ─────────────────────────────────────────────
mp.events.add('inventory:open', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne(
        'SELECT id, carry_base, carry_gym, cash, firstname, lastname, sex FROM characters WHERE cnp = ?',
        [player.data.cnp]
    );
    if (!char) return;

    const items = await db.queryAll(
        `SELECT ci.slot_index, ci.item_name, ci.quantity, ci.metadata,
                i.display_name, i.weight, i.icon, i.item_type, i.is_usable, i.is_droppable, i.bag_capacity
         FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ?
         ORDER BY ci.slot_index`,
        [char.id]
    );

    const clothes = await db.queryAll(
        'SELECT slot, drawable, texture FROM character_clothes WHERE character_id = ?',
        [char.id]
    );

    const currentWeight = await getCurrentWeight(char.id);
    const maxCarry      = await getMaxCarry(char.id);

    player.call('inventory:receiveData', [JSON.stringify({
        items,
        clothes,
        currentWeight: parseFloat(currentWeight.toFixed(2)),
        maxWeight:     maxCarry,
        cash:          char.cash,
        name:          `${char.firstname} ${char.lastname}`,
        sex:           char.sex
    })]);
});

// ── USE ITEM ──────────────────────────────────────────────────
mp.events.add('inventory:useItem', async (player, slotIndex) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const slot = await db.queryOne(
        'SELECT ci.item_name, ci.quantity, i.is_usable, i.display_name FROM character_inventory ci LEFT JOIN items i ON i.name = ci.item_name WHERE ci.character_id = ? AND ci.slot_index = ?',
        [char.id, slotIndex]
    );
    if (!slot || !slot.is_usable) return player.call('hud:notification', ['Acest obiect nu poate fi folosit.', 'error']);

    await handleItemUse(player, char.id, slot.item_name, slot, slotIndex);
});

async function handleItemUse(player, charId, itemName, slot, slotIndex) {
    switch (itemName) {
        case 'bandage':
            if (player.health >= 200) return player.call('hud:notification', ['Ai deja viata plina.', 'warning']);
            player.health = Math.min(200, player.health + 15);
            await consumeItem(charId, slotIndex, 1);
            player.call('hud:notification', ['Ai folosit un bandaj. +15 HP', 'success']);
            break;
        case 'medkit':
            player.health = 200;
            await consumeItem(charId, slotIndex, 1);
            player.call('hud:notification', ['Ai folosit un medkit. HP complet!', 'success']);
            break;
        case 'sandwich':
        case 'water_bottle_l':
        case 'energy_drink':
        case 'water':
        case 'protein_bar':
            mp.events.call('survival:eat', player, itemName);
            await consumeItem(charId, slotIndex, 1);
            break;
        case 'id_card':
            player.call('hud:notification', [`ID: ${player.data.cnp}`, 'info']);
            break;
        case 'phone_basic':
        case 'phone_mid':
        case 'phone_high':
            player.call('phone:open');
            break;
        case 'balaclava':
            player.call('character:toggleBalaclava');
            break;
        default:
            player.call('hud:notification', [`Ai folosit: ${slot.display_name}`, 'info']);
    }
}

// ── EQUIP BAG ─────────────────────────────────────────────────
mp.events.add('inventory:equipBag', async (player, slotIndex) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const slot = await db.queryOne(
        `SELECT ci.item_name, i.bag_capacity, i.display_name FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ? AND ci.slot_index = ?`,
        [char.id, slotIndex]
    );
    if (!slot || !slot.bag_capacity || slot.bag_capacity <= 0)
        return player.call('hud:notification', ['Acest obiect nu este o geanta.', 'error']);

    // Unequip existing bag first (move back to inventory)
    const existing = await db.queryOne(
        'SELECT item_name FROM character_inventory WHERE character_id = ? AND slot_index = -1',
        [char.id]
    );
    if (existing) {
        await giveItem(char.id, existing.item_name, 1);
        await db.update('DELETE FROM character_inventory WHERE character_id = ? AND slot_index = -1', [char.id]);
    }

    // Move to bag slot (slot_index = -1)
    await db.update(
        'UPDATE character_inventory SET slot_index = -1 WHERE character_id = ? AND slot_index = ?',
        [char.id, slotIndex]
    );

    player.call('hud:notification', [`${slot.display_name} echipata! +${slot.bag_capacity}kg capacitate.`, 'success']);
    mp.events.call('inventory:open', player);
});

// ── UNEQUIP BAG ───────────────────────────────────────────────
mp.events.add('inventory:unequipBag', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const bagSlot = await db.queryOne(
        `SELECT ci.item_name, i.display_name, i.bag_capacity FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ? AND ci.slot_index = -1`,
        [char.id]
    );
    if (!bagSlot) return player.call('hud:notification', ['Nu ai nicio geanta echipata.', 'warning']);

    // Move to normal inventory
    const moved = await giveItem(char.id, bagSlot.item_name, 1);
    if (!moved) return player.call('hud:notification', ['Inventar plin. Nu poti dezechipa geanta.', 'error']);

    await db.update('DELETE FROM character_inventory WHERE character_id = ? AND slot_index = -1', [char.id]);
    player.call('hud:notification', [`${bagSlot.display_name} dezechipata.`, 'info']);
    mp.events.call('inventory:open', player);
});

// ── DROP ITEM ─────────────────────────────────────────────────
mp.events.add('inventory:dropItem', async (player, slotIndex) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const slot = await db.queryOne(
        `SELECT ci.item_name, ci.quantity, i.is_droppable, i.display_name, i.weight
         FROM character_inventory ci JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ? AND ci.slot_index = ?`,
        [char.id, slotIndex]
    );
    if (!slot || !slot.is_droppable) return player.call('hud:notification', ['Acest obiect nu poate fi aruncat.', 'error']);

    // Create world drop
    const pos = player.position;
    await db.insert(
        'INSERT INTO world_drops (item_name, quantity, pos_x, pos_y, pos_z, dropped_by_cnp) VALUES (?,?,?,?,?,?)',
        [slot.item_name, slot.quantity, pos.x, pos.y, pos.z, player.data.cnp]
    );

    await db.update('DELETE FROM character_inventory WHERE character_id = ? AND slot_index = ?', [char.id, slotIndex]);
    player.call('hud:notification', [`Ai aruncat: ${slot.display_name}`, 'info']);

    // Notify nearby players
    mp.players.toArray().forEach(p => {
        if (!p.data) return;
        const d = Math.sqrt(Math.pow(p.position.x - pos.x, 2) + Math.pow(p.position.y - pos.y, 2));
        if (d < 15) {
            p.call('inventory:worldDropSpawned', [JSON.stringify({
                item_name:    slot.item_name,
                display_name: slot.display_name,
                quantity:     slot.quantity,
                x: pos.x, y: pos.y, z: pos.z
            })]);
        }
    });
});

// ── PICK UP WORLD DROP ────────────────────────────────────────
mp.events.add('inventory:pickupDrop', async (player, dropId) => {
    if (!player.data || !player.data.cnp) return;
    const drop = await db.queryOne('SELECT * FROM world_drops WHERE id = ? AND picked_up = 0', [dropId]);
    if (!drop) return player.call('hud:notification', ['Obiectul nu mai exista.', 'warning']);

    const pos = player.position;
    const dist = Math.sqrt(Math.pow(pos.x - drop.pos_x, 2) + Math.pow(pos.y - drop.pos_y, 2));
    if (dist > 5) return player.call('hud:notification', ['Esti prea departe.', 'error']);

    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const success = await giveItem(char.id, drop.item_name, drop.quantity);
    if (!success) return player.call('hud:notification', ['Prea greu! Nu poti ridica acest obiect.', 'error']);

    await db.update('UPDATE world_drops SET picked_up = 1 WHERE id = ?', [drop.id]);
    player.call('hud:notification', [`Ai ridicat: ${drop.item_name} x${drop.quantity}`, 'success']);
});

// ── EQUIP CLOTHES ─────────────────────────────────────────────
mp.events.add('inventory:equipClothes', async (player, slot, drawable, texture) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    await db.insert(
        `INSERT INTO character_clothes (character_id, slot, drawable, texture)
         VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE drawable=?, texture=?`,
        [char.id, slot, drawable, texture, drawable, texture]
    );
    player.call('character:applyClothesSlot', [JSON.stringify({ slot, drawable, texture })]);
});

module.exports = { giveItem, consumeItem, getCurrentWeight, getMaxCarry };
