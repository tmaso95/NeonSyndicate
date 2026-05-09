// ── NEON SYNDICATE | GARAGES ──────────────────────────────────

let garageBrowser = null;

// ── OPEN GARAGE UI ────────────────────────────────────────────
mp.events.add('garage:openUI', (dataJSON) => {
    if (!garageBrowser) {
        garageBrowser = mp.browsers.new('package://ui/garages/index.html');
        showCursor(true);
    }
    garageBrowser.execute(`loadGarage(${dataJSON})`);
});

// ── LEGACY: garage:showMenu (keeps existing server events working) ─
mp.events.add('garage:showMenu', (garageJSON) => {
    const garage = JSON.parse(garageJSON);
    mp.events.callRemote('garage:getVehicles', garage.type);

    if (!garageBrowser) {
        garageBrowser = mp.browsers.new('package://ui/garages/index.html');
        showCursor(true);
    }
    garageBrowser.execute(`setGarage(${JSON.stringify(garage)})`);
});

// ── VEHICLE LIST FROM SERVER ──────────────────────────────────
mp.events.add('vehicle:receiveList', (vehiclesJSON) => {
    if (garageBrowser) garageBrowser.execute(`loadVehicles(${vehiclesJSON})`);
});

// ── VEHICLE SPAWNED CONFIRMATION ──────────────────────────────
mp.events.add('garage:vehicleSpawned', () => {
    if (garageBrowser) {
        garageBrowser.destroy();
        garageBrowser = null;
        showCursor(false);
    }
    mp.events.call('hud:notification', 'Vehicul scos din garaj.', 'success');
});

// ── VEHICLE STORED CONFIRMATION ───────────────────────────────
mp.events.add('garage:vehicleStored', () => {
    mp.events.call('hud:notification', 'Vehicul depozitat in garaj.', 'success');
});

// ── CLOSE GARAGE UI ───────────────────────────────────────────
mp.events.add('garage:closeMenu', () => {
    if (garageBrowser) {
        garageBrowser.destroy();
        garageBrowser = null;
    }
    showCursor(false);
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('garage:browserSpawn', (vin) => {
    mp.events.callRemote('vehicle:spawn', vin);
});

mp.events.add('garage:browserStore', (vin, garageId) => {
    mp.events.callRemote('vehicle:store', vin, garageId);
});

mp.events.add('garage:browserShowroom', (type) => {
    mp.events.callRemote('showroom:open', type);
});

mp.events.add('garage:browserClose', () => {
    mp.events.call('garage:closeMenu');
});
