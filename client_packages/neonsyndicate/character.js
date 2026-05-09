// ── NEON SYNDICATE | CHARACTER CREATION ──────────────────────

let charCreationBrowser = null;
let creationCam         = null;
let creationCamMode     = 'face'; // 'face' | 'body'

// Slot name → GTA component ID
const COMPONENT_MAP = {
    mask:        1,
    hair:        2,
    arms:        3,
    legs:        4,
    bag:         5,
    shoes:       6,
    accessories: 7,
    undershirt:  8,
    armor:       9,
    decals:      10,
    top:         11
};

// ── SHOW CHARACTER CREATION ───────────────────────────────────
mp.events.add('character:showCreation', () => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);

    const ped = mp.players.local.handle;

    // Place player in a clean spot for the creation scene
    mp.players.local.position = new mp.Vector3(-867.5, -172.2, 37.8);
    mp.players.local.heading  = 210.0;

    // Freeze and disable controls via safe invoke
    mp.game.invoke('0x428CA6DBD1094446', ped, true); // FREEZE_ENTITY_POSITION
    mp.game.invoke('0xA5FFE9B05F199DE7', 0);          // DISABLE_ALL_CONTROL_ACTIONS

    // Attempt to set up a close-up camera — gracefully degraded if unsupported
    setupCreationCamera('face');

    charCreationBrowser = mp.browsers.new('package://ui/character-creation/index.html');
    setCursorLocked(true);
});

// ── CREATION CAMERA ───────────────────────────────────────────
function setupCreationCamera(mode) {
    try {
        // Tear down any previous camera first
        if (creationCam !== null) {
            try {
                mp.game.cam.renderScriptCams(false, true, 500, true, false);
                mp.game.cam.destroyCam(creationCam, false);
            } catch (e) {}
            creationCam = null;
        }

        const ped = mp.players.local.handle;
        const pos = mp.players.local.position;

        creationCam = mp.game.cam.createCam('DEFAULT_SCRIPTED_CAMERA', true);

        if (mode === 'face') {
            mp.game.cam.setCamCoord(creationCam, pos.x + 1.5, pos.y + 1.5, pos.z + 0.65);
            mp.game.cam.setCamFov(creationCam, 28.0);
            mp.game.cam.pointCamAtEntity(creationCam, ped, 0.0, 0.0, 0.1, true);
        } else {
            mp.game.cam.setCamCoord(creationCam, pos.x + 2.8, pos.y + 2.8, pos.z + 0.6);
            mp.game.cam.setCamFov(creationCam, 45.0);
            mp.game.cam.pointCamAtEntity(creationCam, ped, 0.0, 0.0, 0.0, true);
        }

        mp.game.cam.setCamActive(creationCam, true);
        mp.game.cam.renderScriptCams(true, true, 500, true, false);
        creationCamMode = mode;
    } catch (e) {
        // Camera API unavailable in this RageMP build — creation UI still works without it
        creationCam = null;
    }
}

mp.events.add('character:setCamMode', (mode) => {
    setupCreationCamera(mode);
});

// ── DESTROY CREATION SCENE ────────────────────────────────────
function destroyCreationScene() {
    // Tear down camera gracefully
    try {
        if (creationCam !== null) {
            mp.game.cam.renderScriptCams(false, true, 500, true, false);
            mp.game.cam.destroyCam(creationCam, false);
            creationCam = null;
        }
    } catch (e) {
        creationCam = null;
    }

    // Unfreeze the player
    mp.game.invoke('0x428CA6DBD1094446', mp.players.local.handle, false); // FREEZE_ENTITY_POSITION

    // Close the browser
    if (charCreationBrowser) {
        charCreationBrowser.destroy();
        charCreationBrowser = null;
    }

    setCursorLocked(false);
    mp.game.ui.displayHud(true);
    mp.game.ui.displayRadar(true);
}

// ── APPLY APPEARANCE (real-time preview & final save) ────────
mp.events.add('character:applyAppearance', (dataJSON) => {
    const d   = JSON.parse(dataJSON);
    const ped = mp.players.local.handle;

    // Switch model to match selected sex
    const model = d.sex === 1
        ? mp.game.joaat('mp_f_freemode_01')
        : mp.game.joaat('mp_m_freemode_01');

    if (mp.players.local.model !== model) {
        mp.players.local.model = model;
    }

    // Head blend (parents / skin)
    mp.game.invoke(
        '0x9414E18B9434C2FE', // SET_HEAD_BLEND_DATA
        ped,
        d.shapeFirst  || 0,  d.shapeSecond  || 0, 0,
        d.skinFirst   || 0,  d.skinSecond   || 0, 0,
        parseFloat(d.shapeMix || 0.5),
        parseFloat(d.skinMix  || 0.5),
        0.0, false
    );

    // Eye colour
    mp.game.invoke('0x50B56988B170AFDF', ped, d.eyeColor || 0); // SET_EYE_COLOR

    // Hair style & colour
    mp.game.invoke('0x262B14F48D29DE80', ped, 2, d.hairStyle || 0, 0, 0); // SET_PED_COMPONENT_VARIATION (hair)
    mp.game.invoke('0x2B3B0B955893A68E', ped, d.hairColor || 0, d.hairHighlight || 0); // SET_PED_HAIR_COLOR

    // Face features (20 sliders)
    if (Array.isArray(d.faceFeatures)) {
        d.faceFeatures.forEach((val, idx) => {
            mp.game.invoke('0x71A5C1DBA060049E', ped, idx, parseFloat(val), false); // SET_FACE_FEATURE
        });
    }

    // Face overlays (makeup, eyebrows, beard, etc.)
    if (d.faceOverlays && typeof d.faceOverlays === 'object') {
        for (const [key, val] of Object.entries(d.faceOverlays)) {
            mp.game.invoke(
                '0x48F44967FA05CC1E', // SET_PED_FACE_DECORATION
                ped,
                parseInt(key),
                val.index   || 0,
                val.opacity || 1.0,
                val.color1  || 0,
                val.color2  || 0
            );
        }
    }
});

// ── APPLY FULL CLOTHES SET ────────────────────────────────────
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

// ── APPLY SINGLE CLOTHES SLOT ─────────────────────────────────
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
    // Slot 1 = mask component
    mp.game.invoke('0x262B14F48D29DE80', ped, 1, balaclavaOn ? 45 : 0, 0, 0); // SET_PED_COMPONENT_VARIATION
});

// ── CHARACTER ERROR ───────────────────────────────────────────
mp.events.add('character:error', (msg) => {
    if (charCreationBrowser) {
        const safe = msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        charCreationBrowser.execute(`showError('${safe}')`);
    }
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('character:browserPreviewUpdate', (dataJSON) => {
    // Apply locally for instant preview; no server round-trip needed
    mp.events.call('character:applyAppearance', dataJSON);
});

mp.events.add('character:browserCreate', (dataJSON) => {
    mp.events.callRemote('character:create', dataJSON);
    destroyCreationScene();
});

// ── RENDER: keep controls disabled during creation ────────────
mp.events.add('render', () => {
    if (charCreationBrowser) {
        mp.game.invoke('0xA5FFE9B05F199DE7', 0); // DISABLE_ALL_CONTROL_ACTIONS
    }
});
