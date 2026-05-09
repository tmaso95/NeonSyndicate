let phoneBrowser = null;

mp.events.add('phone:receiveData', (dataJSON) => {
    if (!phoneBrowser) {
        phoneBrowser = mp.browsers.new('package://ui/phone/index.html');
        mp.cursor.show(true, true);
    }
    phoneBrowser.execute(`initPhone(${dataJSON})`);
});

mp.events.add('phone:receiveSMS', (msgJSON) => {
    if (phoneBrowser) phoneBrowser.execute(`receiveSMS(${msgJSON})`);
});

mp.events.add('phone:receiveConversation', (convJSON) => {
    if (phoneBrowser) phoneBrowser.execute(`loadConversation(${convJSON})`);
});

mp.events.add('phone:smsSent', () => {
    if (phoneBrowser) phoneBrowser.execute('smsSent()');
});

mp.events.add('phone:contactAdded', (contactJSON) => {
    if (phoneBrowser) phoneBrowser.execute(`contactAdded(${contactJSON})`);
});

mp.events.add('phone:contactDeleted', (cnp) => {
    if (phoneBrowser) phoneBrowser.execute(`contactDeleted('${cnp}')`);
});

mp.events.add('phone:error', (msg) => {
    if (phoneBrowser) phoneBrowser.execute(`phoneError('${msg.replace(/'/g, "\\'")}')`);
});

// Key: M (phone)
mp.keys.bind(0x4D, true, () => {
    if (phoneBrowser) {
        phoneBrowser.destroy();
        phoneBrowser = null;
        mp.cursor.show(false, false);
    } else {
        mp.events.callRemote('phone:open');
    }
});

// Browser events
mp.events.add('phone:browserSendSMS',      (cnp, msg)  => mp.events.callRemote('phone:sendSMS', cnp, msg));
mp.events.add('phone:browserGetConv',      (cnp)       => mp.events.callRemote('phone:getConversation', cnp));
mp.events.add('phone:browserAddContact',   (cnp, name) => mp.events.callRemote('phone:addContact', cnp, name));
mp.events.add('phone:browserDeleteContact',(cnp)       => mp.events.callRemote('phone:deleteContact', cnp));
mp.events.add('phone:browserClose',        ()          => {
    if (phoneBrowser) { phoneBrowser.destroy(); phoneBrowser = null; }
    mp.cursor.show(false, false);
});
