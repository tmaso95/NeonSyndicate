let showroomBrowser  = null;
let previewVehicle   = null;

mp.events.add('showroom:receiveData', (dataJSON) => {
    if (!showroomBrowser) {
        showroomBrowser = mp.browsers.new('package://ui/showroom/index.html');
        showCursor(true);
    }
    showroomBrowser.execute(`loadShowroom(${dataJSON})`);
});

mp.events.add('showroom:receiveModel', (modelJSON) => {
    if (showroomBrowser) {
        showroomBrowser.execute(`previewModel(${modelJSON})`);
        spawnPreview(JSON.parse(modelJSON));
    }
});

function spawnPreview(model) {
    if (previewVehicle) {
        previewVehicle.destroy();
        previewVehicle = null;
    }
    const pos = mp.players.local.position;
    previewVehicle = mp.vehicles.new(
        mp.game.joaat(model.model_hash),
        new mp.Vector3(pos.x + 6, pos.y, pos.z),
        { heading: 270, locked: true, engine: false }
    );
}

mp.events.add('showroom:close', () => {
    if (previewVehicle) { previewVehicle.destroy(); previewVehicle = null; }
    if (showroomBrowser) { showroomBrowser.destroy(); showroomBrowser = null; }
    showCursor(false);
});

// Browser events
mp.events.add('showroom:browserOpen',    (type)                      => mp.events.callRemote('showroom:open',   type));
mp.events.add('showroom:browserPreview', (modelId)                   => mp.events.callRemote('showroom:getModel', modelId));
mp.events.add('showroom:browserBuy',     (modelId, color1, color2)   => mp.events.callRemote('showroom:buy',   modelId, color1, color2));
mp.events.add('showroom:browserClose',   ()                          => mp.events.call('showroom:close'));
