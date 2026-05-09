const db = require('../../database/connection');

const MAX_SLOTS  = 30;
const MAX_WEIGHT = 15.0;

// ── GET INVENTORY ─────────────────────────────────────────────
mp.events.add('inventory:open', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const items   = await db.queryAll(
        `SELECT ci.slot_index, ci.item_name, ci.quantity, ci.metadata,
                i.display_name, i.weight, i.icon, i.item_type, i.is_usable, i.is_droppable
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

    const charInfo = await db.queryOne('SELECT cash, firstname, lastname, sex FROM characters WHERE id = ?', [char.id]);

    player.call('inventory:receiveData', [JSON.stringify({
        items,
        clothes,
        maxSlots:  MAX_SLOTS,
        maxWeight: MAX_WEIGHT,
        cash:      charInfo.cash,
        name:      `${charInfo.firstname} ${charInfo.lastname}`,
        sex:       charInfo.sex
    })]);
});

// ── USE ITEM ──────────────────────────────────────────────────
mp.events.add('inventory:useItem', async (player, slotIndex) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const slot = await db.queryOne(
        'SELECT item_name, quantity FROM character_inventory WHERE character_id = ? AND slot_index = ?',
        [char.id, slotIndex]
    );
    if (!slot) return;

    const item = await db.queryOne('SELECT * FROM items WHERE name = ?', [slot.item_name]);
    if (!item || !item.is_usable) return player.call('hud:notification', ['Acest obiect nu poate fi folosit.', 'error']);

    await handleItemUse(player, char.id, item, slot, slotIndex);
});

async function handleItemUse(player, charId, item, slot, slotIndex) {
    switch (item.name) {
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
        case 'id_card':
            player.call('hud:notification', [`ID: ${player.data.cnp}`, 'info']);
            break;
        case 'phone':
            player.call('phone:open');
            break;
        case 'balaclava':
            player.call('character:toggleBalaclava');
            break;
        default:
            player.call('hud:notification', [`Ai folosit: ${item.display_name}`, 'info']);
    }
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

// ── DROP ITEM ─────────────────────────────────────────────────
mp.events.add('inventory:dropItem', async (player, slotIndex) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char) return;

    const slot = await db.queryOne(
        `SELECT ci.item_name, ci.quantity, i.is_droppable, i.display_name
         FROM character_inventory ci JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ? AND ci.slot_index = ?`,
        [char.id, slotIndex]
    );
    if (!slot) return;
    if (!slot.is_droppable) return player.call('hud:notification', ['Acest obiect nu poate fi aruncat.', 'error']);

    await db.update('DELETE FROM character_inventory WHERE character_id = ? AND slot_index = ?', [char.id, slotIndex]);
    player.call('hud:notification', [`Ai aruncat: ${slot.display_name}`, 'info']);
});

// ── GIVE ITEM (server utility) ────────────────────────────────
async function giveItem(charId, itemName, quantity, metadata = null) {
    const item = await db.queryOne('SELECT max_stack FROM items WHERE name = ?', [itemName]);
    if (!item) return false;

    const existing = await db.queryOne(
        'SELECT id, slot_index, quantity FROM character_inventory WHERE character_id = ? AND item_name = ?',
        [charId, itemName]
    );

    if (existing && existing.quantity + quantity <= item.max_stack) {
        await db.update('UPDATE character_inventory SET quantity = quantity + ? WHERE id = ?',
            [quantity, existing.id]);
        return true;
    }

    // Find free slot
    const usedSlots = await db.queryAll('SELECT slot_index FROM character_inventory WHERE character_id = ?', [charId]);
    const usedSet   = new Set(usedSlots.map(r => r.slot_index));
    let freeSlot    = -1;
    for (let i = 0; i < MAX_SLOTS; i++) {
        if (!usedSet.has(i)) { freeSlot = i; break; }
    }
    if (freeSlot === -1) return false;

    await db.insert(
        'INSERT INTO character_inventory (character_id, item_name, quantity, slot_index, metadata) VALUES (?,?,?,?,?)',
        [charId, itemName, quantity, freeSlot, metadata ? JSON.stringify(metadata) : null]
    );
    return true;
}

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

module.exports = { giveItem, consumeItem };
