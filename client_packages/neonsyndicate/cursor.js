// ── NEON SYNDICATE | CURSOR MANAGER ──────────────────────────
// Single source of truth for cursor visibility across all modules.

let _cursorVisible = false;
let _authLocked    = false; // true during auth / char-creation — backtick cannot override

/**
 * Show or hide the cursor.
 * @param {boolean} visible  - Whether the cursor should be visible.
 * @param {boolean} lockCam  - Whether the camera should be locked (defaults to visible).
 */
global.showCursor = function(visible, lockCam) {
    _cursorVisible = visible;
    try {
        if (mp.cursor) mp.cursor.show(visible, lockCam !== undefined ? lockCam : visible);
    } catch (e) {}
};

/**
 * Lock the cursor on (auth screen / character creation).
 * While locked, the backtick key cannot toggle the cursor off.
 * @param {boolean} on
 */
global.setCursorLocked = function(on) {
    _authLocked = on;
    showCursor(on, on);
};

// ` / ~ key (VK_OEM_3 = 0xC0) — manual cursor toggle during gameplay
// Ignored while auth or character-creation has the cursor locked.
mp.keys.bind(0xC0, true, () => {
    if (_authLocked) return;
    showCursor(!_cursorVisible, !_cursorVisible);
});
