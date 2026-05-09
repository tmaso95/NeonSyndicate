let bizBrowser = null;

mp.events.add('business:showMenu', (bizJSON) => {
    if (!bizBrowser) {
        bizBrowser = mp.browsers.new('package://ui/businesses/index.html');
        showCursor(true);
    }
    bizBrowser.execute(`showMenu(${bizJSON})`);
    // Load stock
    const biz = JSON.parse(bizJSON);
    mp.events.callRemote('business:getStock', biz.id);
});

mp.events.add('business:closeMenu', () => {
    if (bizBrowser) {
        bizBrowser.destroy();
        bizBrowser = null;
        showCursor(false);
    }
});

mp.events.add('business:receiveStock', (dataJSON) => {
    if (bizBrowser) bizBrowser.execute(`loadStock(${dataJSON})`);
});

mp.events.add('business:receiveRevenue', (dataJSON) => {
    if (bizBrowser) bizBrowser.execute(`loadRevenue(${dataJSON})`);
});

// Browser → server
mp.events.add('business:browserBuy',            (bizId, item, qty) => mp.events.callRemote('business:buyItem',        bizId, item, qty));
mp.events.add('business:browserBuyBusiness',    (bizId)            => mp.events.callRemote('business:buy',            bizId));
mp.events.add('business:browserSetPrice',       (bizId, item, p)   => mp.events.callRemote('business:setPrice',       bizId, item, p));
mp.events.add('business:browserRestock',        (bizId, item, qty) => mp.events.callRemote('business:restock',        bizId, item, qty));
mp.events.add('business:browserGetRevenue',     (bizId)            => mp.events.callRemote('business:getRevenue',     bizId));
mp.events.add('business:browserWithdrawRevenue',(bizId)            => mp.events.callRemote('business:withdrawRevenue',bizId));
mp.events.add('business:browserClose', () => {
    if (bizBrowser) { bizBrowser.destroy(); bizBrowser = null; }
    showCursor(false);
});
