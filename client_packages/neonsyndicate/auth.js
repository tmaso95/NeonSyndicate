// ── NEON SYNDICATE | AUTHENTICATION ──────────────────────────

let authBrowser = null;

// ── SHOW AUTH UI ──────────────────────────────────────────────
mp.events.add('auth:showUI', () => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);

    // Fade screen in from black over 1.5 s
    mp.game.invoke('0xD4E8E24955024033', 1500); // DO_SCREEN_FADE_IN

    if (!authBrowser) {
        authBrowser = mp.browsers.new('package://ui/auth/index.html');
    }
    setCursorLocked(true);
});

// ── AUTH SUCCESS ──────────────────────────────────────────────
mp.events.add('auth:success', (type, accountId) => {
    if (authBrowser) {
        authBrowser.destroy();
        authBrowser = null;
    }
    setCursorLocked(false);
});

// ── AUTH ERROR ────────────────────────────────────────────────
mp.events.add('auth:error', (message) => {
    if (authBrowser) {
        const safe = message.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        authBrowser.execute(`showError('${safe}')`);
    }
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('auth:browserLogin', (email, password) => {
    mp.events.callRemote('auth:login', email, password);
});

mp.events.add('auth:browserRegister', (email, password) => {
    mp.events.callRemote('auth:register', email, password);
});
