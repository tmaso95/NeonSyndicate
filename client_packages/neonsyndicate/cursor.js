// In RageMP client, variables are NOT shared between files via require.
// Attach to `global` so all other scripts can call showCursor().
global.showCursor = function(visible, lockCam) {
    try {
        if (mp.cursor) {
            mp.cursor.show(visible, lockCam !== undefined ? lockCam : visible);
        }
    } catch (e) {}
};
