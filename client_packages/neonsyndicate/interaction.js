// ── NEON SYNDICATE | E-KEY INTERACTION SYSTEM ────────────────
// Tracks the nearest POI broadcast by the server and fires the
// interaction remote when the player presses E (or G for vehicles).

let nearPOI = null; // parsed POI object or null when out of range

// ── SERVER → CLIENT: enter POI range ─────────────────────────
mp.events.add('interaction:nearPOI', (poiJSON) => {
    try {
        nearPOI = JSON.parse(poiJSON);
    } catch (e) {
        nearPOI = null;
        return;
    }
    // Show the interaction hint on the HUD
    mp.events.call('hud:showInteractionHint', nearPOI.name || 'Interactiune');
});

// ── SERVER → CLIENT: leave POI range ─────────────────────────
mp.events.add('interaction:leavePOI', () => {
    nearPOI = null;
    mp.events.call('hud:hideInteractionHint');
});

// ── E KEY (0x45) — primary interaction ───────────────────────
mp.keys.bind(0x45, true, () => {
    if (!nearPOI) return;
    mp.events.callRemote('interaction:keyE');
});

// ── G KEY (0x47) — enter / exit vehicle interaction ──────────
// Also used as a secondary context action at certain POIs.
mp.keys.bind(0x47, true, () => {
    const local = mp.players.local;
    if (local.vehicle) {
        // Player is already in a vehicle — exit intent handled by GTA natively,
        // but we still notify the server in case a POI wraps it (fuel, etc.).
        mp.events.callRemote('interaction:keyG', true);
    } else {
        // Player on foot — ask server to handle enter/exit or POI action
        mp.events.callRemote('interaction:keyG', false);
    }
});
