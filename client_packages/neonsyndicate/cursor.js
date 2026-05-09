// ── CURSOR MANAGER ────────────────────────────────────────────
// Tracks cursor state so all modules share a single source of truth.

let _cursorVisible = false;
let _authLocked    = false; // true during auth / char-creation

global.showCursor = function(visible, lockCam) {
    _cursorVisible = visible;
    try {
        if (mp.cursor) mp.cursor.show(visible, lockCam !== undefined ? lockCam : visible);
    } catch(e) {}
};

// Called by auth & char-creation to force cursor on/off
global.setCursorLocked = function(on) {
    _authLocked = on;
    showCursor(on, on);
};

// ` / ~ key (VK_OEM_3 = 0xC0) — manual cursor toggle
// Works when a UI is open in gameplay (phone, showroom, etc.)
// Ignored while auth/char-creation has cursor locked on.
mp.keys.bind(0xC0, true, () => {
    if (_authLocked) return;
    showCursor(!_cursorVisible, !_cursorVisible);
});
