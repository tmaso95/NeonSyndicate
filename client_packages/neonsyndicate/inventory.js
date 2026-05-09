// ── NEON SYNDICATE | INVENTORY ────────────────────────────────

let inventoryBrowser = null;

// ── RECEIVE INVENTORY DATA (open / refresh) ───────────────────
mp.events.add('inventory:receiveData', (dataJSON) => {
    if (!inventoryBrowser) {
        inventoryBrowser = mp.browsers.new('package://ui/inventory/index.html');
        showCursor(true);
    }
    inventoryBrowser.execute(`loadInventory(${dataJSON})`);
});

// ── OPEN TRUNK (vehicle storage) ─────────────────────────────
mp.events.add('inventory:openTrunk', (vin, trunkJSON) => {
    if (!inventoryBrowser) {
        inventoryBrowser = mp.browsers.new('package://ui/inventory/index.html');
        showCursor(true);
    }
    inventoryBrowser.execute(`openTrunk('${vin}', ${trunkJSON})`);
});

// ── I KEY — toggle inventory ──────────────────────────────────
mp.keys.bind(0x49, true, () => {
    if (inventoryBrowser) {
        inventoryBrowser.destroy();
        inventoryBrowser = null;
        showCursor(false);
    } else {
        mp.events.callRemote('inventory:open');
    }
});

// ── WORLD DROP SPAWNED NEARBY ─────────────────────────────────
mp.events.add('inventory:worldDropSpawned', (dropJSON) => {
    try {
        const drop = JSON.parse(dropJSON);
        const name = (drop && drop.item) ? drop.item : 'Item';
        mp.events.call('hud:notification', `Pickup nearby: ${name}`, 'info');
    } catch (e) {}
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('inventory:browserUse', (slot) => {
    mp.events.callRemote('inventory:useItem', slot);
});

mp.events.add('inventory:browserDrop', (slot, qty) => {
    mp.events.callRemote('inventory:dropItem', slot, qty);
});

mp.events.add('inventory:browserMove', (fromSlot, toSlot) => {
    mp.events.callRemote('inventory:moveItem', fromSlot, toSlot);
});

mp.events.add('inventory:browserEquipBag', (slot) => {
    mp.events.callRemote('inventory:equipBag', slot);
});

mp.events.add('inventory:browserEquip', (slot, drawable, texture) => {
    mp.events.callRemote('inventory:equipClothes', slot, drawable, texture);
});

mp.events.add('inventory:browserSaveTrunk', (vin, rear, front) => {
    mp.events.callRemote('vehicle:saveTrunk', vin, rear, front);
});

mp.events.add('inventory:browserClose', () => {
    if (inventoryBrowser) {
        inventoryBrowser.destroy();
        inventoryBrowser = null;
    }
    showCursor(false);
});
