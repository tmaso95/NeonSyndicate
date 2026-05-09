let hudBrowser  = null;
let hudVisible  = false;
let _pendingStats = null;

// Stats arrive with hud:show; applied once the browser signals ready.
mp.events.add('hud:show', (statsJSON) => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(true);
    if (!hudBrowser) {
        hudBrowser = mp.browsers.new('package://ui/hud/index.html');
    }
    hudVisible = true;
    if (statsJSON) _pendingStats = statsJSON;
});

// Browser fires this after its scripts finish loading.
mp.events.add('hud:ready', () => {
    if (_pendingStats && hudBrowser) {
        hudBrowser.execute(`updateStats(${_pendingStats})`);
        _pendingStats = null;
    }
});

mp.events.add('hud:hide', () => {
    if (hudBrowser) hudBrowser.execute('hideHud()');
    hudVisible = false;
});

mp.events.add('hud:updateStats', (statsJSON) => {
    if (hudBrowser) {
        hudBrowser.execute(`updateStats(${statsJSON})`);
    }
});

mp.events.add('hud:notification', (message, type) => {
    if (hudBrowser) {
        hudBrowser.execute(`showNotification('${message.replace(/'/g, "\\'")}', '${type || 'info'}')`);
    }
});

// ── TICK: update health/armor/speed on HUD ────────────────────
mp.events.add('render', () => {
    if (!hudBrowser || !hudVisible) return;

    const local = mp.players.local;
    if (!local) return;

    const hp    = local.health  > 100 ? local.health - 100 : 0;
    const armor = local.armour;
    const speed = Math.round(mp.game.entity.getEntitySpeed(local.handle) * 3.6);
    const inVeh = local.vehicle !== null;

    hudBrowser.execute(`updateVitals(${hp}, ${armor}, ${speed}, ${inVeh})`);
});

// ── SURVIVAL STATS ────────────────────────────────────────────
mp.events.add('hud:survivalStats', (statsJSON) => {
    if (hudBrowser) hudBrowser.execute(`updateSurvival(${statsJSON})`);
});

// ── MINIMAP ───────────────────────────────────────────────────
mp.game.ui.setRadarZoom(1100);
