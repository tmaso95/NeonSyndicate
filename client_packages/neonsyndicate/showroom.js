// ── NEON SYNDICATE | SHOWROOM ─────────────────────────────────

let showroomBrowser = null;
let previewVehicle  = null;

// ── RECEIVE SHOWROOM LISTING ──────────────────────────────────
mp.events.add('showroom:receiveData', (dataJSON) => {
    if (!showroomBrowser) {
        showroomBrowser = mp.browsers.new('package://ui/showroom/index.html');
        showCursor(true);
    }
    showroomBrowser.execute(`loadShowroom(${dataJSON})`);
});

// ── RECEIVE MODEL FOR PREVIEW ─────────────────────────────────
mp.events.add('showroom:receiveModel', (modelJSON) => {
    if (showroomBrowser) {
        showroomBrowser.execute(`previewModel(${modelJSON})`);
        spawnPreview(JSON.parse(modelJSON));
    }
});

// ── SPAWN A PREVIEW VEHICLE NEAR THE PLAYER ───────────────────
function spawnPreview(model) {
    // Destroy the current preview if one exists
    if (previewVehicle) {
        try { previewVehicle.destroy(); } catch (e) {}
        previewVehicle = null;
    }

    try {
        const pos = mp.players.local.position;
        previewVehicle = mp.vehicles.new(
            mp.game.joaat(model.model_hash),
            new mp.Vector3(pos.x + 6, pos.y, pos.z),
            { heading: 270, locked: true, engine: false }
        );
    } catch (e) {
        previewVehicle = null;
    }
}

// ── PURCHASE SUCCESS ──────────────────────────────────────────
mp.events.add('showroom:purchaseSuccess', () => {
    if (previewVehicle) {
        try { previewVehicle.destroy(); } catch (e) {}
        previewVehicle = null;
    }
    mp.events.call('hud:notification', 'Vehicul achizitionat cu succes!', 'success');
    mp.events.call('showroom:close');
});

// ── CLOSE SHOWROOM ────────────────────────────────────────────
mp.events.add('showroom:close', () => {
    if (previewVehicle) {
        try { previewVehicle.destroy(); } catch (e) {}
        previewVehicle = null;
    }
    if (showroomBrowser) {
        showroomBrowser.destroy();
        showroomBrowser = null;
    }
    showCursor(false);
});

// ── BROWSER → SERVER / LOCAL BRIDGES ─────────────────────────
mp.events.add('showroom:browserOpen', (type) => {
    mp.events.callRemote('showroom:open', type);
});

mp.events.add('showroom:browserPreview', (modelId) => {
    mp.events.callRemote('showroom:getModel', modelId);
});

mp.events.add('showroom:browserBuy', (modelId, color1, color2) => {
    mp.events.callRemote('showroom:buy', modelId, color1, color2);
});

mp.events.add('showroom:browserClose', () => {
    mp.events.call('showroom:close');
});
