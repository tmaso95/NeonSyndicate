const db = require('../../database/connection');

// ── OPEN PHONE ────────────────────────────────────────────────
mp.events.add('phone:open', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const contacts = await db.queryAll(
        'SELECT contact_cnp, contact_name FROM phone_contacts WHERE owner_cnp = ? ORDER BY contact_name',
        [player.data.cnp]
    );
    const unreadCount = await db.queryOne(
        'SELECT COUNT(*) as cnt FROM phone_messages WHERE receiver_cnp = ? AND is_read = 0',
        [player.data.cnp]
    );
    player.call('phone:receiveData', [JSON.stringify({
        cnp:        player.data.cnp,
        contacts,
        unread:     unreadCount ? unreadCount.cnt : 0
    })]);
});

// ── SEND SMS ──────────────────────────────────────────────────
mp.events.add('phone:sendSMS', async (player, receiverCnp, message) => {
    if (!player.data || !player.data.cnp) return;
    if (!message || message.length > 512) return player.call('phone:error', ['Mesaj invalid.']);

    const receiver = await db.queryOne('SELECT cnp FROM characters WHERE cnp = ?', [receiverCnp]);
    if (!receiver) return player.call('phone:error', ['Numar inexistent.']);

    await db.insert(
        'INSERT INTO phone_messages (sender_cnp, receiver_cnp, message) VALUES (?,?,?)',
        [player.data.cnp, receiverCnp, message]
    );

    // Deliver in real time if online
    const target = mp.players.toArray().find(p => p.data && p.data.cnp === receiverCnp);
    if (target) {
        const senderChar = await db.queryOne('SELECT firstname, lastname FROM characters WHERE cnp = ?', [player.data.cnp]);
        const senderName = senderChar ? `${senderChar.firstname} ${senderChar.lastname}` : player.data.cnp;
        target.call('phone:receiveSMS', [JSON.stringify({ from: player.data.cnp, senderName, message })]);
        target.call('hud:notification', [`SMS de la ${senderName}`, 'info']);
    }
    player.call('phone:smsSent');
});

// ── GET CONVERSATION ──────────────────────────────────────────
mp.events.add('phone:getConversation', async (player, otherCnp) => {
    if (!player.data || !player.data.cnp) return;

    const messages = await db.queryAll(
        `SELECT sender_cnp, receiver_cnp, message, sent_at, is_read
         FROM phone_messages
         WHERE (sender_cnp = ? AND receiver_cnp = ?) OR (sender_cnp = ? AND receiver_cnp = ?)
         ORDER BY sent_at ASC LIMIT 50`,
        [player.data.cnp, otherCnp, otherCnp, player.data.cnp]
    );

    // Mark as read
    await db.update(
        'UPDATE phone_messages SET is_read = 1 WHERE receiver_cnp = ? AND sender_cnp = ?',
        [player.data.cnp, otherCnp]
    );

    player.call('phone:receiveConversation', [JSON.stringify({ messages, with: otherCnp })]);
});

// ── ADD CONTACT ───────────────────────────────────────────────
mp.events.add('phone:addContact', async (player, cnp, name) => {
    if (!player.data || !player.data.cnp) return;
    if (!cnp || !name) return;

    const exists = await db.queryOne('SELECT cnp FROM characters WHERE cnp = ?', [cnp]);
    if (!exists) return player.call('phone:error', ['CNP inexistent.']);

    try {
        await db.insert(
            'INSERT INTO phone_contacts (owner_cnp, contact_cnp, contact_name) VALUES (?,?,?)',
            [player.data.cnp, cnp, name.substring(0, 32)]
        );
        player.call('phone:contactAdded', [JSON.stringify({ cnp, name })]);
    } catch {
        player.call('phone:error', ['Contact deja existent.']);
    }
});

// ── DELETE CONTACT ────────────────────────────────────────────
mp.events.add('phone:deleteContact', async (player, cnp) => {
    if (!player.data || !player.data.cnp) return;
    await db.update('DELETE FROM phone_contacts WHERE owner_cnp = ? AND contact_cnp = ?', [player.data.cnp, cnp]);
    player.call('phone:contactDeleted', [cnp]);
});
