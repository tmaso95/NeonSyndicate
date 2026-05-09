let hudBrowser  = null;
let hudVisible  = false;

mp.events.add('hud:show', () => {
    mp.game.ui.displayHud(false);  // Hide default GTA HUD
    mp.game.ui.displayRadar(true);
    if (!hudBrowser) {
        hudBrowser = mp.browsers.new('package://ui/hud/index.html');
    }
    hudVisible = true;
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

// ── TICK: update health/armor/money on HUD ────────────────────
mp.events.add('render', () => {
    if (!hudBrowser || !hudVisible) return;

    const local = mp.players.local;
    if (!local) return;

    const hp     = local.health  > 100 ? local.health - 100 : 0;
    const armor  = local.armour;
    const speed  = Math.round(mp.game.entity.getEntitySpeed(local.handle) * 3.6);
    const inVeh  = local.vehicle !== null;

    hudBrowser.execute(`updateVitals(${hp}, ${armor}, ${speed}, ${inVeh})`);
});

// ── SURVIVAL STATS (forwarded from survival.js) ───────────────
mp.events.add('hud:survivalStats', (statsJSON) => {
    if (hudBrowser) hudBrowser.execute(`updateSurvival(${statsJSON})`);
});

// ── MINIMAP ───────────────────────────────────────────────────
mp.game.ui.setRadarZoom(1100);
