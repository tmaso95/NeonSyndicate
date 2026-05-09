let gymBrowser = null;

mp.events.add('gym:showMenu', (gymDataJSON) => {
    if (!gymBrowser) {
        gymBrowser = mp.browsers.new('package://ui/gym/index.html');
        showCursor(true);
    }
    gymBrowser.execute(`showGymMenu(${gymDataJSON})`);
    mp.events.callRemote('gym:getStats');
});

mp.events.add('gym:closeMenu', () => {
    if (gymBrowser) {
        gymBrowser.destroy();
        gymBrowser = null;
        showCursor(false);
    }
});

mp.events.add('gym:receiveStats', (statsJSON) => {
    if (gymBrowser) gymBrowser.execute(`loadStats(${statsJSON})`);
});

mp.events.add('gym:exerciseComplete', (resultJSON) => {
    if (gymBrowser) gymBrowser.execute(`exerciseComplete(${resultJSON})`);
});

// Browser → server
mp.events.add('gym:browserStart',  (type, dur) => mp.events.callRemote('gym:startExercise', type, dur));
mp.events.add('gym:browserStats',  ()          => mp.events.callRemote('gym:getStats'));
mp.events.add('gym:browserClose', () => {
    if (gymBrowser) { gymBrowser.destroy(); gymBrowser = null; }
    showCursor(false);
});
