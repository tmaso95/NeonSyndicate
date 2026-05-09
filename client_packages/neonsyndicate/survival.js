// ── NEON SYNDICATE | SURVIVAL ─────────────────────────────────
// Survival stats (hunger, thirst, stress, stamina) are rendered
// inside the main HUD browser. This module bridges server events
// and relays them through hud.js via the local event bus.

// Server → client: periodic stats update
mp.events.add('survival:updateStats', (statsJSON) => {
    // Re-emit as hud:survivalStats so hud.js forwards it to the browser
    mp.events.call('hud:survivalStats', statsJSON);
});

// Inventory UI signals the player ate/drank something
mp.events.add('inventory:useFood', (itemName) => {
    mp.events.callRemote('survival:eat', itemName);
});

// Manual stats request (e.g. called by other modules)
mp.events.add('survival:requestStats', () => {
    mp.events.callRemote('survival:requestStats');
});

// Request fresh stats after the character spawns into the world
mp.events.add('character:spawned', () => {
    mp.events.callRemote('survival:requestStats');
});
