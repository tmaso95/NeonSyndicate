let adminBrowser = null;

mp.events.add('admin:receivePanel', (dataJSON) => {
    if (!adminBrowser) {
        adminBrowser = mp.browsers.new('package://ui/admin/index.html');
        showCursor(true);
    }
    adminBrowser.execute(`loadPanel(${dataJSON})`);
});

mp.events.add('admin:toggleGodClient', (enabled) => {
    // God mode: handle damage locally
    mp.game.entity.setEntityInvincible(mp.players.local.handle, enabled);
});

mp.events.add('admin:startSpectate', (targetId) => {
    // Basic spectate implementation
    mp.game.cameras.renderScriptCams(false, false, 0, true, false);
});

mp.events.add('admin:setTag', (label, rank) => {
    // Store admin info locally
    mp.storage.data.adminTag   = label;
    mp.storage.data.adminRank  = rank;
});

// Key: F6 = 0x75
mp.keys.bind(0x75, true, () => {
    if (adminBrowser) {
        adminBrowser.destroy();
        adminBrowser = null;
        showCursor(false);
    } else {
        mp.events.callRemote('admin:openPanel');
    }
});

// Browser → server bridges
mp.events.add('admin:browserKick',       (id, reason)    => mp.events.callRemote('admin:kick',       id, reason));
mp.events.add('admin:browserBan',        (id, reason)    => mp.events.callRemote('admin:ban',        id, reason));
mp.events.add('admin:browserGiveMoney',  (id, amount)    => mp.events.callRemote('admin:giveMoney',  id, amount));
mp.events.add('admin:browserTp',         (id)            => mp.events.callRemote('admin:tpToPlayer', id));
mp.events.add('admin:browserSpectate',   (id)            => mp.events.callRemote('admin:spectate',   id));
mp.events.add('admin:browserHeal',       (id)            => mp.events.callRemote('admin:heal',       id));
mp.events.add('admin:browserSetWanted',  (id, lvl)       => mp.events.callRemote('admin:setWanted',  id, lvl));
mp.events.add('admin:browserAnnounce',   (msg)           => mp.events.callRemote('admin:announce',   msg));
mp.events.add('admin:browserSetRank',    (email, rank)   => mp.events.callRemote('admin:setRank',    email, rank));
mp.events.add('admin:browserUnban',      (email)         => mp.events.callRemote('admin:unban',      email));
mp.events.add('admin:browserToggleGod',  ()              => mp.events.callRemote('admin:toggleGod'));
mp.events.add('admin:browserClose', () => {
    if (adminBrowser) { adminBrowser.destroy(); adminBrowser = null; }
    showCursor(false);
});
