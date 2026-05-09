let inventoryBrowser = null;

mp.events.add('inventory:receiveData', (dataJSON) => {
    if (!inventoryBrowser) {
        inventoryBrowser = mp.browsers.new('package://ui/inventory/index.html');
        mp.cursor.show(true, true);
    }
    inventoryBrowser.execute(`loadInventory(${dataJSON})`);
});

mp.events.add('inventory:openTrunk', (vin, trunkJSON) => {
    if (!inventoryBrowser) {
        inventoryBrowser = mp.browsers.new('package://ui/inventory/index.html');
        mp.cursor.show(true, true);
    }
    inventoryBrowser.execute(`openTrunk('${vin}', ${trunkJSON})`);
});

// Key: I
mp.keys.bind(0x49, true, () => {
    if (inventoryBrowser) {
        inventoryBrowser.destroy();
        inventoryBrowser = null;
        mp.cursor.show(false, false);
    } else {
        mp.events.callRemote('inventory:open');
    }
});

// Browser events
mp.events.add('inventory:browserUse',         (slot)            => mp.events.callRemote('inventory:useItem', slot));
mp.events.add('inventory:browserDrop',        (slot)            => mp.events.callRemote('inventory:dropItem', slot));
mp.events.add('inventory:browserEquip',       (slot, drawable, texture) => mp.events.callRemote('inventory:equipClothes', slot, drawable, texture));
mp.events.add('inventory:browserSaveTrunk',   (vin, rear, front) => mp.events.callRemote('vehicle:saveTrunk', vin, rear, front));
mp.events.add('inventory:browserClose',       ()                => {
    if (inventoryBrowser) { inventoryBrowser.destroy(); inventoryBrowser = null; }
    mp.cursor.show(false, false);
});
