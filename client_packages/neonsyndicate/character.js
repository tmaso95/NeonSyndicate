let charCreationBrowser = null;
let creationCam         = null;
let creationCamMode     = 'face'; // 'face' | 'body'

// ── CHARACTER CREATION SCENE ──────────────────────────────────
mp.events.add('character:showCreation', () => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);

    const ped = mp.players.local.handle;

    // Teleport to a quiet character creation spot
    mp.players.local.position = new mp.Vector3(-867.5, -172.2, 37.8);
    mp.players.local.heading  = 210.0;

    // Freeze player in place
    mp.game.entity.freezeEntityPosition(ped, true);

    // Disable all player controls (movement, camera etc.)
    mp.game.controls.disableAllActions(0);

    // Set up camera looking at face
    setupCreationCamera('face');

    charCreationBrowser = mp.browsers.new('package://ui/character-creation/index.html');
    showCursor(true);
});

function setupCreationCamera(mode) {
    // Destroy existing cam
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
        // Close-up on face
        mp.game.cam.setCamCoord(creationCam, pos.x + 1.5, pos.y + 1.5, pos.z + 0.65);
        mp.game.cam.setCamFov(creationCam, 28.0);
        mp.game.cam.pointCamAtEntity(creationCam, ped, 0.0, 0.0, 0.1, true);
    } else {
        // Full body view
        mp.game.cam.setCamCoord(creationCam, pos.x + 2.8, pos.y + 2.8, pos.z + 0.6);
        mp.game.cam.setCamFov(creationCam, 45.0);
        mp.game.cam.pointCamAtEntity(creationCam, ped, 0.0, 0.0, 0.0, true);
    }

    mp.game.cam.setCamActive(creationCam, true);
    mp.game.cam.renderScriptCams(true, true, 500, true, false);
    creationCamMode = mode;
}

// Browser requests camera switch
mp.events.add('character:setCamMode', (mode) => {
    setupCreationCamera(mode);
});

// ── DESTROY CREATION SCENE ────────────────────────────────────
function destroyCreationScene() {
    if (creationCam !== null) {
        try {
            mp.game.cam.renderScriptCams(false, true, 500, true, false);
            mp.game.cam.destroyCam(creationCam, false);
        } catch (e) {}
        creationCam = null;
    }
    mp.game.entity.freezeEntityPosition(mp.players.local.handle, false);
    if (charCreationBrowser) {
        charCreationBrowser.destroy();
        charCreationBrowser = null;
    }
    showCursor(false);
    mp.game.ui.displayHud(true);
    mp.game.ui.displayRadar(true);
}

// ── APPLY APPEARANCE (real-time preview) ──────────────────────
mp.events.add('character:applyAppearance', (dataJSON) => {
    const d   = JSON.parse(dataJSON);
    const ped = mp.players.local.handle;

    // Gender model
    const model = d.sex === 1 ? mp.game.joaat('mp_f_freemode_01') : mp.game.joaat('mp_m_freemode_01');
    if (mp.players.local.model !== model) {
        mp.players.local.model = model;
    }

    // Head blend
    mp.game.invoke(
        '0x9414E18B9434C2FE',
        ped,
        d.shapeFirst || 0,  d.shapeSecond || 0, 0,
        d.skinFirst  || 0,  d.skinSecond  || 0, 0,
        parseFloat(d.shapeMix || 0.5), parseFloat(d.skinMix || 0.5), 0.0, false
    );

    // Eye color
    mp.game.invoke('0x50B56988B170AFDF', ped, d.eyeColor || 0);

    // Hair component + color
    mp.game.invoke('0x262B14F48D29DE80', ped, 2, d.hairStyle || 0, 0, 0);
    mp.game.invoke('0x2B3B0B955893A68E', ped, d.hairColor || 0, d.hairHighlight || 0);

    // Face features (20 sliders)
    if (Array.isArray(d.faceFeatures)) {
        d.faceFeatures.forEach((val, idx) => {
            mp.game.invoke('0x71A5C1DBA060049E', ped, idx, parseFloat(val), false);
        });
    }

    // Face overlays (makeup/blemishes etc.)
    if (d.faceOverlays && typeof d.faceOverlays === 'object') {
        for (const [key, val] of Object.entries(d.faceOverlays)) {
            mp.game.invoke('0x48F44967FA05CC1E', ped, parseInt(key), val.index || 0, val.opacity || 1.0, val.color1 || 0, val.color2 || 0);
        }
    }
});

// ── APPLY ALL CLOTHES ─────────────────────────────────────────
const COMPONENT_MAP = {
    mask:        1, hair:       2, arms:       3,
    legs:        4, bag:        5, shoes:      6,
    accessories: 7, undershirt: 8, armor:      9,
    decals:     10, top:       11
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

// ── BROWSER → SERVER ──────────────────────────────────────────
mp.events.add('character:browserPreviewUpdate', (dataJSON) => {
    // Apply appearance in real-time as sliders change
    mp.events.call('character:applyAppearance', dataJSON);
});

mp.events.add('character:browserCreate', (dataJSON) => {
    mp.events.callRemote('character:create', dataJSON);
    destroyCreationScene();
});

mp.events.add('character:error', (msg) => {
    if (charCreationBrowser) {
        charCreationBrowser.execute(`showError('${msg.replace(/'/g, "\\'")}')`);
    }
});

// Keep controls disabled while in creation (render tick)
mp.events.add('render', () => {
    if (charCreationBrowser) {
        mp.game.controls.disableAllActions(0);
    }
});
