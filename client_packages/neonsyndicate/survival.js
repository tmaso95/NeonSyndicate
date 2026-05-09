// Survival stats are rendered inside the main HUD browser
mp.events.add('survival:updateStats', (statsJSON) => {
    const hudBrowser = mp.browsers.getByUrl && mp.browsers.getByUrl('package://ui/hud/index.html');
    // Broadcast to all active browsers; hud.js stores reference globally via window
    mp.events.call('hud:survivalStats', statsJSON);
});

// Bridge: hud.js listens to 'hud:survivalStats' and forwards to the browser
// (survival stats arrive from server via survival:updateStats, re-emitted here)
mp.events.add('inventory:useFood', (itemName) => {
    mp.events.callRemote('survival:eat', itemName);
});

mp.events.add('survival:requestStats', () => {
    mp.events.callRemote('survival:requestStats');
});

// Request stats on spawn
mp.events.add('character:spawned', () => {
    mp.events.callRemote('survival:requestStats');
});
