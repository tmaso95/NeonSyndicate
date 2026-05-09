// ── NEON SYNDICATE | PHONE ────────────────────────────────────
// The phone browser is transparent / overlay.
// It does NOT auto-show the cursor — the player uses the ` key
// (handled in cursor.js) to toggle it while the phone is open.

let phoneBrowser = null;

// ── RECEIVE PHONE DATA (open / refresh) ──────────────────────
mp.events.add('phone:receiveData', (dataJSON) => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://ui/phone/index.html');
        // No showCursor here — player uses ` to toggle manually
    }
    phoneBrowser.execute(`initPhone(${dataJSON})`);
});

// ── INCOMING SMS ──────────────────────────────────────────────
mp.events.add('phone:receiveSMS', (msgJSON) => {
    if (phoneBrowser) phoneBrowser.execute(`receiveSMS(${msgJSON})`);
});

// ── CONVERSATION LOAD ─────────────────────────────────────────
mp.events.add('phone:receiveConversation', (convJSON) => {
    if (phoneBrowser) phoneBrowser.execute(`loadConversation(${convJSON})`);
});

// ── SMS SENT CONFIRMATION ─────────────────────────────────────
mp.events.add('phone:smsSent', () => {
    if (phoneBrowser) phoneBrowser.execute('smsSent()');
});

// ── CONTACT ADDED ─────────────────────────────────────────────
mp.events.add('phone:contactAdded', (contactJSON) => {
    if (phoneBrowser) phoneBrowser.execute(`contactAdded(${contactJSON})`);
});

// ── CONTACT DELETED ───────────────────────────────────────────
mp.events.add('phone:contactDeleted', (cnp) => {
    if (phoneBrowser) phoneBrowser.execute(`contactDeleted('${cnp}')`);
});

// ── PHONE ERROR ───────────────────────────────────────────────
mp.events.add('phone:error', (msg) => {
    if (phoneBrowser) {
        const safe = msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        phoneBrowser.execute(`phoneError('${safe}')`);
    }
});

// ── M KEY — open / close phone ────────────────────────────────
mp.keys.bind(0x4D, true, () => {
    if (phoneBrowser) {
        phoneBrowser.destroy();
        phoneBrowser = null;
        showCursor(false);
    } else {
        mp.events.callRemote('phone:open');
    }
});

// ── BROWSER → SERVER BRIDGES ──────────────────────────────────
mp.events.add('phone:browserSendSMS', (cnp, msg) => {
    mp.events.callRemote('phone:sendSMS', cnp, msg);
});

mp.events.add('phone:browserGetConv', (cnp) => {
    mp.events.callRemote('phone:getConversation', cnp);
});

mp.events.add('phone:browserAddContact', (cnp, name) => {
    mp.events.callRemote('phone:addContact', cnp, name);
});

mp.events.add('phone:browserDeleteContact', (cnp) => {
    mp.events.callRemote('phone:deleteContact', cnp);
});

mp.events.add('phone:browserClose', () => {
    if (phoneBrowser) {
        phoneBrowser.destroy();
        phoneBrowser = null;
    }
    showCursor(false);
});
