// ── NEON SYNDICATE | HUD ──────────────────────────────────────

let hudBrowser    = null;
let hudVisible    = false;
let _pendingStats = null;

// ── SHOW HUD ──────────────────────────────────────────────────
mp.events.add('hud:show', (statsJSON) => {
    // Suppress the native GTA HUD and radar; we render our own.
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);

    if (!hudBrowser) {
        hudBrowser = mp.browsers.new('package://ui/hud/index.html');
    }
    hudVisible = true;
    if (statsJSON) _pendingStats = statsJSON;
});

// ── BROWSER READY ─────────────────────────────────────────────
// The browser fires this after its scripts finish loading so we
// can safely call JS functions inside it.
mp.events.add('hud:ready', () => {
    if (_pendingStats && hudBrowser) {
        hudBrowser.execute(`updateStats(${_pendingStats})`);
        _pendingStats = null;
    }
});

// ── HIDE HUD ──────────────────────────────────────────────────
mp.events.add('hud:hide', () => {
    if (hudBrowser) hudBrowser.execute('hideHud()');
    hudVisible = false;
});

// ── UPDATE STATS (money, job, name, etc.) ─────────────────────
mp.events.add('hud:updateStats', (statsJSON) => {
    if (hudBrowser) {
        hudBrowser.execute(`updateStats(${statsJSON})`);
    }
});

// ── NOTIFICATION ──────────────────────────────────────────────
mp.events.add('hud:notification', (message, type) => {
    if (hudBrowser) {
        const safe = message.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        hudBrowser.execute(`showNotification('${safe}', '${type || 'info'}')`);
    }
});

// ── SURVIVAL STATS (hunger, thirst, stress …) ─────────────────
mp.events.add('hud:survivalStats', (statsJSON) => {
    if (hudBrowser) hudBrowser.execute(`updateSurvival(${statsJSON})`);
});

// ── INTERACTION HINT (show / hide "Press [E]" tip) ────────────
mp.events.add('hud:showInteractionHint', (poiName) => {
    if (hudBrowser) {
        const safe = (poiName || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        hudBrowser.execute(`showHint('${safe}')`);
    }
});

mp.events.add('hud:hideInteractionHint', () => {
    if (hudBrowser) hudBrowser.execute('hideHint()');
});

// ── WANTED LEVEL RELAY ────────────────────────────────────────
mp.events.add('hud:updateWanted', (level) => {
    if (hudBrowser) hudBrowser.execute(`updateWanted(${level})`);
});

// ── RENDER: vitals update every frame ────────────────────────
mp.events.add('render', () => {
    if (!hudBrowser || !hudVisible) return;

    const local = mp.players.local;
    if (!local) return;

    const hp    = local.health  > 100 ? local.health - 100 : 0;
    const armor = local.armour;
    const speed = Math.round((mp.game.invoke('0xD5037BA82E99E895', local.handle) || 0) * 3.6);
    const inVeh = local.vehicle !== null;

    hudBrowser.execute(`updateVitals(${hp}, ${armor}, ${speed}, ${inVeh})`);
});

// ── MINIMAP ZOOM ──────────────────────────────────────────────
mp.game.ui.setRadarZoom(1100);
