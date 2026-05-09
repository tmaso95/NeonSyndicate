let authBrowser = null;

mp.events.add('auth:showUI', () => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);
    mp.game.invoke('0xD4E8E24955024033', 1500); // DO_SCREEN_FADE_IN

    authBrowser = mp.browsers.new('package://ui/auth/index.html');
    setCursorLocked(true);
});

mp.events.add('auth:success', (type, accountId) => {
    if (authBrowser) {
        authBrowser.destroy();
        authBrowser = null;
        setCursorLocked(false);
    }
});

mp.events.add('auth:error', (message) => {
    if (authBrowser) {
        authBrowser.execute(`showError('${message.replace(/'/g, "\\'")}')`);
    }
});

// Bridge browser -> server
mp.events.add('auth:browserRegister', (email, password) => {
    mp.events.callRemote('auth:register', email, password);
});

mp.events.add('auth:browserLogin', (email, password) => {
    mp.events.callRemote('auth:login', email, password);
});
