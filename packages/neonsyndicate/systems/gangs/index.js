const db = require('../../database/connection');

// ── CREATE GANG ───────────────────────────────────────────────
mp.events.add('gang:create', async (player, name, tag, type) => {
    if (!player.data || !player.data.cnp) return;

    const existing = await db.queryOne('SELECT id FROM gang_members WHERE character_cnp = ?', [player.data.cnp]);
    if (existing) return player.call('hud:notification', ['Esti deja intr-o organizatie.', 'error']);

    const nameOk = name && name.length >= 3 && name.length <= 64;
    const tagOk  = tag  && tag.length  >= 2 && tag.length  <= 6;
    if (!nameOk || !tagOk) return player.call('hud:notification', ['Nume sau tag invalid.', 'error']);

    try {
        const gangId = await db.insert(
            'INSERT INTO gangs (name, tag, gang_type) VALUES (?,?,?)',
            [name, tag.toUpperCase(), type === 'mafia' ? 'mafia' : 'gang']
        );
        await db.insert(
            'INSERT INTO gang_members (gang_id, character_cnp, gang_rank) VALUES (?,?,5)',
            [gangId, player.data.cnp]
        );
        await db.update('UPDATE characters SET gang_id = ?, gang_rank = 5 WHERE cnp = ?', [gangId, player.data.cnp]);
        player.call('hud:notification', [`Organizatia "${name}" a fost creata!`, 'success']);
    } catch {
        player.call('hud:notification', ['Nume sau tag deja folosit.', 'error']);
    }
});

// ── INVITE MEMBER ─────────────────────────────────────────────
mp.events.add('gang:invite', async (player, targetCnp) => {
    if (!player.data || !player.data.cnp) return;

    const member = await db.queryOne(
        'SELECT gang_id, gang_rank FROM gang_members WHERE character_cnp = ?',
        [player.data.cnp]
    );
    if (!member || member.gang_rank < 3) return player.call('hud:notification', ['Grad insuficient pentru invitatie.', 'error']);

    const targetMember = await db.queryOne('SELECT id FROM gang_members WHERE character_cnp = ?', [targetCnp]);
    if (targetMember) return player.call('hud:notification', ['Tinta este deja intr-o organizatie.', 'error']);

    const target = mp.players.toArray().find(p => p.data && p.data.cnp === targetCnp);
    if (!target) return player.call('hud:notification', ['Jucator offline.', 'error']);

    const gang = await db.queryOne('SELECT name FROM gangs WHERE id = ?', [member.gang_id]);
    target.call('gang:receiveInvite', [JSON.stringify({
        gangId:    member.gang_id,
        gangName:  gang.name,
        fromCnp:   player.data.cnp
    })]);
    player.call('hud:notification', [`Invitatie trimisa catre ${targetCnp}.`, 'info']);
});

// ── ACCEPT INVITE ─────────────────────────────────────────────
mp.events.add('gang:acceptInvite', async (player, gangId) => {
    if (!player.data || !player.data.cnp) return;

    const existing = await db.queryOne('SELECT id FROM gang_members WHERE character_cnp = ?', [player.data.cnp]);
    if (existing) return player.call('hud:notification', ['Esti deja intr-o organizatie.', 'error']);

    const gang = await db.queryOne('SELECT id, name, max_members FROM gangs WHERE id = ?', [gangId]);
    if (!gang) return;

    const count = await db.queryOne('SELECT COUNT(*) as cnt FROM gang_members WHERE gang_id = ?', [gangId]);
    if (count.cnt >= gang.max_members) return player.call('hud:notification', ['Organizatia este plina.', 'error']);

    await db.insert('INSERT INTO gang_members (gang_id, character_cnp, gang_rank) VALUES (?,?,0)', [gangId, player.data.cnp]);
    await db.update('UPDATE characters SET gang_id = ?, gang_rank = 0 WHERE cnp = ?', [gangId, player.data.cnp]);
    player.call('hud:notification', [`Te-ai alaturat organizatiei "${gang.name}"!`, 'success']);
});

// ── LEAVE GANG ────────────────────────────────────────────────
mp.events.add('gang:leave', async (player) => {
    if (!player.data || !player.data.cnp) return;

    const member = await db.queryOne('SELECT gang_id, gang_rank FROM gang_members WHERE character_cnp = ?', [player.data.cnp]);
    if (!member) return;
    if (member.gang_rank === 5) return player.call('hud:notification', ['Liderul nu poate parasi organizatia. Tranfera intai lidershipul.', 'error']);

    await db.update('DELETE FROM gang_members WHERE character_cnp = ?', [player.data.cnp]);
    await db.update('UPDATE characters SET gang_id = NULL, gang_rank = 0 WHERE cnp = ?', [player.data.cnp]);
    player.call('hud:notification', ['Ai parasit organizatia.', 'info']);
});

// ── GET GANG INFO ─────────────────────────────────────────────
mp.events.add('gang:getInfo', async (player) => {
    if (!player.data || !player.data.cnp) return;

    const member = await db.queryOne('SELECT gang_id, gang_rank FROM gang_members WHERE character_cnp = ?', [player.data.cnp]);
    if (!member) return player.call('gang:receiveInfo', ['null']);

    const gang = await db.queryOne('SELECT * FROM gangs WHERE id = ?', [member.gang_id]);
    const members = await db.queryAll(
        `SELECT gm.character_cnp, gm.gang_rank, c.firstname, c.lastname
         FROM gang_members gm JOIN characters c ON c.cnp = gm.character_cnp
         WHERE gm.gang_id = ? ORDER BY gm.gang_rank DESC`,
        [member.gang_id]
    );

    player.call('gang:receiveInfo', [JSON.stringify({ gang, members, myRank: member.gang_rank })]);
});
