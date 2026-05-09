// ── NEON SYNDICATE | ADMIN PANEL ─────────────────────────────

let adminBrowser = null;

// ── OPEN ADMIN PANEL ──────────────────────────────────────────
mp.events.add('admin:receivePanel', (dataJSON) => {
    if (!adminBrowser) {
        adminBrowser = mp.browsers.new('package://ui/admin/index.html');
        showCursor(true);
    }
    adminBrowser.execute(`loadPanel(${dataJSON})`);
});

// ── GOD MODE (client side) ────────────────────────────────────
mp.events.add('admin:toggleGodClient', (enabled) => {
    mp.game.invoke('0xB8A6322200FE3D87', mp.players.local.handle, enabled); // SET_ENTITY_INVINCIBLE
});

// ── SPECTATE (camera reset) ───────────────────────────────────
mp.events.add('admin:startSpectate', (targetId) => {
    try {
        mp.game.cam.renderScriptCams(false, false, 0, true, false);
    } catch (e) {}
});

// ── STORE ADMIN TAG LOCALLY ───────────────────────────────────
mp.events.add('admin:setTag', (label, rank) => {
    mp.storage.data.adminTag  = label;
    mp.storage.data.adminRank = rank;
});

// ── SERVER ANNOUNCEMENT (big-screen notification) ─────────────
mp.events.add('admin:announcement', (msg) => {
    mp.events.call('hud:notification', `[ANUNT] ${msg}`, 'warning');
});

// ── F6 KEY — toggle admin panel ───────────────────────────────
mp.keys.bind(0x75, true, () => {
    if (adminBrowser) {
        adminBrowser.destroy();
        adminBrowser = null;
        showCursor(false);
    } else {
        mp.events.callRemote('admin:openPanel');
    }
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('admin:browserKick',          (id, reason)    => mp.events.callRemote('admin:kick',         id, reason));
mp.events.add('admin:browserBan',           (id, reason)    => mp.events.callRemote('admin:ban',          id, reason));
mp.events.add('admin:browserGiveMoney',     (id, amount)    => mp.events.callRemote('admin:giveMoney',    id, amount));
mp.events.add('admin:browserTp',            (id)            => mp.events.callRemote('admin:tpToPlayer',   id));
mp.events.add('admin:browserSpectate',      (id)            => mp.events.callRemote('admin:spectate',     id));
mp.events.add('admin:browserHeal',          (id)            => mp.events.callRemote('admin:heal',         id));
mp.events.add('admin:browserSetWanted',     (id, lvl)       => mp.events.callRemote('admin:setWanted',    id, lvl));
mp.events.add('admin:browserAnnounce',      (msg)           => mp.events.callRemote('admin:announce',     msg));
mp.events.add('admin:browserSetRank',       (email, rank)   => mp.events.callRemote('admin:setRank',      email, rank));
mp.events.add('admin:browserUnban',         (email)         => mp.events.callRemote('admin:unban',        email));
mp.events.add('admin:browserToggleGod',     ()              => mp.events.callRemote('admin:toggleGod'));

mp.events.add('admin:browserClose', () => {
    if (adminBrowser) {
        adminBrowser.destroy();
        adminBrowser = null;
    }
    showCursor(false);
});
