let garageBrowser = null;

mp.events.add('garage:showMenu', (garageJSON) => {
    const garage = JSON.parse(garageJSON);
    mp.events.callRemote('garage:getVehicles', garage.type);

    if (!garageBrowser) {
        garageBrowser = mp.browsers.new('package://ui/garages/index.html');
        mp.cursor.show(true, true);
    }
    garageBrowser.execute(`setGarage(${JSON.stringify(garage)})`);
});

mp.events.add('vehicle:receiveList', (vehiclesJSON) => {
    if (garageBrowser) garageBrowser.execute(`loadVehicles(${vehiclesJSON})`);
});

mp.events.add('garage:closeMenu', () => {
    if (garageBrowser) { garageBrowser.destroy(); garageBrowser = null; }
    mp.cursor.show(false, false);
});

// Browser events
mp.events.add('garage:browserSpawn', (vin)          => mp.events.callRemote('vehicle:spawn', vin));
mp.events.add('garage:browserStore', (vin, garageId)=> mp.events.callRemote('vehicle:store', vin, garageId));
mp.events.add('garage:browserClose', ()             => mp.events.call('garage:closeMenu'));
mp.events.add('garage:browserShowroom', (type)      => mp.events.callRemote('showroom:open', type));
