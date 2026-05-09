let authBrowser = null;

mp.events.add('auth:showUI', () => {
    mp.game.ui.displayHud(false);
    mp.game.ui.displayRadar(false);
    mp.game.cam.doScreenFadeIn(1500);

    authBrowser = mp.browsers.new('package://ui/auth/index.html');
    showCursor(true);
});

mp.events.add('auth:success', (type, accountId) => {
    if (authBrowser) {
        authBrowser.destroy();
        authBrowser = null;
        showCursor(false);
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
