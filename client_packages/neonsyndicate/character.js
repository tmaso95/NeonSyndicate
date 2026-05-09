let charCreationBrowser = null;

// ── SHOW CHARACTER CREATION UI ────────────────────────────────
mp.events.add('character:showCreation', () => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);
    charCreationBrowser = mp.browsers.new('package://ui/character-creation/index.html');
    showCursor(true);
});

// ── APPLY APPEARANCE ──────────────────────────────────────────
mp.events.add('character:applyAppearance', (dataJSON) => {
    const d = JSON.parse(dataJSON);
    const ped = mp.players.local.handle;

    mp.game.invoke(
        '0x9414E18B9434C2FE', // SET_PED_HEAD_BLEND_DATA
        ped,
        d.shapeFirst,  d.shapeSecond, 0,
        d.skinFirst,   d.skinSecond,  0,
        d.shapeMix,    d.skinMix,     0.0, false
    );

    // Eye color
    mp.game.invoke('0x50B56988B170AFDF', ped, d.eyeColor);

    // Hair
    mp.game.invoke('0x4CFFC65454C93A49', ped, d.hairStyle, 0);
    mp.game.invoke('0x4CFFC65454C93A49', ped, d.hairStyle, 0);
    mp.game.invoke('0x2B3B0B955893A68E', ped, d.hairColor, d.hairHighlight);

    // Face features
    if (Array.isArray(d.faceFeatures)) {
        d.faceFeatures.forEach((val, idx) => {
            mp.game.invoke('0x71A5C1DBA060049E', ped, idx, val, false);
        });
    }

    // Face overlays
    if (d.faceOverlays && typeof d.faceOverlays === 'object') {
        for (const [key, val] of Object.entries(d.faceOverlays)) {
            mp.game.invoke('0x48F44967FA05CC1E', ped, parseInt(key), val.index || 0, val.opacity || 1.0, val.color1 || 0, val.color2 || 0);
        }
    }
});

// ── APPLY ALL CLOTHES ─────────────────────────────────────────
const COMPONENT_MAP = {
    mask:       1, hair:       2, arms:       3,
    legs:       4, bag:        5, shoes:      6,
    accessories:7, undershirt: 8, armor:      9,
    decals:    10, top:       11
};

mp.events.add('character:applyClothes', (clothesJSON) => {
    const clothes = JSON.parse(clothesJSON);
    const ped     = mp.players.local.handle;
    for (const item of clothes) {
        const compId = COMPONENT_MAP[item.slot];
        if (compId !== undefined) {
            mp.game.invoke('0x262B14F48D29DE80', ped, compId, item.drawable, item.texture, 0);
        }
    }
});

mp.events.add('character:applyClothesSlot', (slotJSON) => {
    const item   = JSON.parse(slotJSON);
    const ped    = mp.players.local.handle;
    const compId = COMPONENT_MAP[item.slot];
    if (compId !== undefined) {
        mp.game.invoke('0x262B14F48D29DE80', ped, compId, item.drawable, item.texture, 0);
    }
});

// ── BALACLAVA TOGGLE ──────────────────────────────────────────
let balaclavaOn = false;
mp.events.add('character:toggleBalaclava', () => {
    const ped = mp.players.local.handle;
    balaclavaOn = !balaclavaOn;
    mp.game.invoke('0x262B14F48D29DE80', ped, 1, balaclavaOn ? 45 : 0, 0, 0);
});

// ── BROWSER -> SERVER BRIDGE ──────────────────────────────────
mp.events.add('character:browserCreate', (dataJSON) => {
    mp.events.callRemote('character:create', dataJSON);
    if (charCreationBrowser) {
        charCreationBrowser.destroy();
        charCreationBrowser = null;
        showCursor(false);
    }
});

mp.events.add('character:error', (msg) => {
    if (charCreationBrowser) {
        charCreationBrowser.execute(`showError('${msg.replace(/'/g, "\\'")}')`);
    }
});
