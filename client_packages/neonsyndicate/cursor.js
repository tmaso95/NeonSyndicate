// Safe cursor wrapper — mp.cursor is undefined in some RageMP builds
function showCursor(visible, lockCam) {
    try {
        if (mp.cursor) {
            mp.cursor.show(visible, lockCam !== undefined ? lockCam : visible);
        }
    } catch (e) {}
}
