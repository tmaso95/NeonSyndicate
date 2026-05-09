// ── NEON SYNDICATE | BUSINESSES ───────────────────────────────

let businessBrowser = null;

// ── OPEN BUSINESS UI ──────────────────────────────────────────
mp.events.add('business:openUI', (dataJSON) => {
    if (!businessBrowser) {
        businessBrowser = mp.browsers.new('package://ui/businesses/index.html');
        showCursor(true);
    }
    businessBrowser.execute(`loadBusiness(${dataJSON})`);
});

// ── LEGACY: business:showMenu (keeps existing server events working) ─
mp.events.add('business:showMenu', (bizJSON) => {
    if (!businessBrowser) {
        businessBrowser = mp.browsers.new('package://ui/businesses/index.html');
        showCursor(true);
    }
    businessBrowser.execute(`showMenu(${bizJSON})`);
    try {
        const biz = JSON.parse(bizJSON);
        mp.events.callRemote('business:getStock', biz.id);
    } catch (e) {}
});

// ── CLOSE BUSINESS UI ─────────────────────────────────────────
mp.events.add('business:closeMenu', () => {
    if (businessBrowser) {
        businessBrowser.destroy();
        businessBrowser = null;
    }
    showCursor(false);
});

// ── STOCK / REVENUE DATA FROM SERVER ─────────────────────────
mp.events.add('business:receiveStock', (dataJSON) => {
    if (businessBrowser) businessBrowser.execute(`loadStock(${dataJSON})`);
});

mp.events.add('business:receiveRevenue', (dataJSON) => {
    if (businessBrowser) businessBrowser.execute(`loadRevenue(${dataJSON})`);
});

// ── ITEM BOUGHT CONFIRMATION ──────────────────────────────────
mp.events.add('business:itemBought', (msg) => {
    mp.events.call('hud:notification', msg || 'Produs achizitionat!', 'success');
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('business:browserBuy', (bizId, itemName, qty) => {
    mp.events.callRemote('business:buyItem', bizId, itemName, qty);
});

mp.events.add('business:browserBuyBusiness', (bizId) => {
    mp.events.callRemote('business:buy', bizId);
});

mp.events.add('business:browserSetPrice', (bizId, item, price) => {
    mp.events.callRemote('business:setPrice', bizId, item, price);
});

mp.events.add('business:browserRestock', (bizId, item, qty) => {
    mp.events.callRemote('business:restock', bizId, item, qty);
});

mp.events.add('business:browserGetRevenue', (bizId) => {
    mp.events.callRemote('business:getRevenue', bizId);
});

mp.events.add('business:browserWithdrawRevenue', (bizId) => {
    mp.events.callRemote('business:withdrawRevenue', bizId);
});

mp.events.add('business:browserClose', () => {
    if (businessBrowser) {
        businessBrowser.destroy();
        businessBrowser = null;
    }
    showCursor(false);
});
