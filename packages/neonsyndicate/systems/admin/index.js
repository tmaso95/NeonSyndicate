const db = require('../../database/connection');

// Rank hierarchy (higher number = more power)
const RANKS = {
    tester:     0,
    helper:     1,
    moderator:  2,
    admin:      3,
    head_admin: 4,
    co_owner:   5,
    owner:      6
};

const RANK_LABELS = {
    tester:     '[TESTER]',
    helper:     '[HELPER]',
    moderator:  '[MOD]',
    admin:      '[ADMIN]',
    head_admin: '[H.ADMIN]',
    co_owner:   '[CO-OWNER]',
    owner:      '[OWNER]'
};

// Cache admin data on login
async function loadAdminData(player) {
    if (!player.data || !player.data.accountId) return;
    const admin = await db.queryOne(
        'SELECT admin_rank FROM admins WHERE account_id = ? AND is_active = 1',
        [player.data.accountId]
    );
    player.data.adminRank  = admin ? admin.admin_rank : null;
    player.data.adminLevel = admin ? RANKS[admin.admin_rank] : -1;
}

function isAdmin(player, minRank = 'helper') {
    if (!player.data) return false;
    return (player.data.adminLevel || -1) >= RANKS[minRank];
}

function isTester(player) {
    return player.data && player.data.adminRank !== null;
}

// ── OPEN ADMIN PANEL ─────────────────────────────────────────
mp.events.add('admin:openPanel', async (player) => {
    if (!isAdmin(player, 'helper')) return;

    const players = mp.players.toArray().map(p => ({
        id:   p.id,
        name: p.data && p.data.character ? `${p.data.character.firstname} ${p.data.character.lastname}` : 'Loading',
        cnp:  p.data && p.data.cnp ? p.data.cnp : '---',
        ping: p.ping,
        rank: p.data && p.data.adminRank ? p.data.adminRank : null
    }));

    player.call('admin:receivePanel', [JSON.stringify({
        myRank:  player.data.adminRank,
        myLevel: player.data.adminLevel,
        players
    })]);
});

// ── KICK ────────────────────────────────────────────────────
mp.events.add('admin:kick', async (player, targetId, reason) => {
    if (!isAdmin(player, 'helper')) return;
    const target = mp.players.at(targetId);
    if (!target) return player.call('hud:notification', ['Jucator negasit.', 'error']);
    if ((target.data.adminLevel || -1) >= (player.data.adminLevel || -1)) return player.call('hud:notification', ['Nu poti da kick unui admin de rang egal sau mai mare.', 'error']);
    target.kick(`Kick de admin: ${reason || 'fara motiv'}`);
    console.log(`[ADMIN] ${player.data.cnp} a kickat jucatorul ${targetId} (${reason})`);
    player.call('hud:notification', [`Jucatorul a fost kickat.`, 'success']);
});

// ── BAN ─────────────────────────────────────────────────────
mp.events.add('admin:ban', async (player, targetId, reason) => {
    if (!isAdmin(player, 'moderator')) return;
    const target = mp.players.at(targetId);
    if (!target) return player.call('hud:notification', ['Jucator negasit.', 'error']);
    if ((target.data.adminLevel || -1) >= (player.data.adminLevel || -1)) return player.call('hud:notification', ['Nu poti bana un admin de rang egal sau mai mare.', 'error']);

    const accId = target.data && target.data.accountId;
    if (accId) {
        await db.update('UPDATE accounts SET is_banned = 1, ban_reason = ? WHERE id = ?', [reason || 'Ban admin', accId]);
    }
    target.kick(`Banat: ${reason || 'fara motiv'}`);
    console.log(`[ADMIN] ${player.data.cnp} a banat cont #${accId} (${reason})`);
    player.call('hud:notification', ['Jucatorul a fost banat.', 'success']);
});

// ── UNBAN ───────────────────────────────────────────────────
mp.events.add('admin:unban', async (player, email) => {
    if (!isAdmin(player, 'moderator')) return;
    const affected = await db.update('UPDATE accounts SET is_banned = 0, ban_reason = NULL WHERE email = ?', [email]);
    if (affected) player.call('hud:notification', [`Cont ${email} a fost debanat.`, 'success']);
    else player.call('hud:notification', ['Email negasit.', 'error']);
});

// ── GIVE MONEY ───────────────────────────────────────────────
mp.events.add('admin:giveMoney', async (player, targetId, amount) => {
    if (!isAdmin(player, 'admin')) return;
    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return player.call('hud:notification', ['Jucator negasit.', 'error']);
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) return player.call('hud:notification', ['Suma invalida.', 'error']);
    await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [amount, target.data.cnp]);
    target.call('hud:notification', [`Ai primit $${amount} de la admin.`, 'success']);
    player.call('hud:notification', [`$${amount} trimisi catre ${target.data.cnp}.`, 'success']);
});

// ── TELEPORT TO PLAYER ────────────────────────────────────────
mp.events.add('admin:tpToPlayer', (player, targetId) => {
    if (!isAdmin(player, 'helper')) return;
    const target = mp.players.at(targetId);
    if (!target) return player.call('hud:notification', ['Jucator negasit.', 'error']);
    const pos = target.position;
    player.position = new mp.Vector3(pos.x + 2, pos.y, pos.z);
    player.dimension = target.dimension;
    player.call('hud:notification', [`Teleportat la jucatorul ${targetId}.`, 'info']);
});

// ── SPECTATE ──────────────────────────────────────────────────
mp.events.add('admin:spectate', (player, targetId) => {
    if (!isAdmin(player, 'helper')) return;
    const target = mp.players.at(targetId);
    if (!target) return;
    player.call('admin:startSpectate', [targetId]);
});

// ── SET WANTED ───────────────────────────────────────────────
mp.events.add('admin:setWanted', async (player, targetId, level) => {
    if (!isAdmin(player, 'helper')) return;
    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return;
    level = Math.max(0, Math.min(5, parseInt(level)));
    await db.update('UPDATE characters SET wanted_level = ? WHERE cnp = ?', [level, target.data.cnp]);
    target.call('hud:updateWanted', [level]);
    player.call('hud:notification', [`Wanted level setat la ${level}.`, 'success']);
});

// ── HEAL PLAYER ───────────────────────────────────────────────
mp.events.add('admin:heal', (player, targetId) => {
    if (!isAdmin(player, 'helper')) return;
    const target = targetId >= 0 ? mp.players.at(targetId) : player;
    if (!target) return;
    target.health = 200;
    target.armour = 100;
    if (target.data && target.data.cnp) {
        db.update('UPDATE characters SET hunger=100, thirst=100, stamina=100, stress=0 WHERE cnp=?', [target.data.cnp]);
    }
    target.call('hud:notification', ['HP, armor si stats refacute.', 'success']);
});

// ── SET ADMIN RANK ────────────────────────────────────────────
mp.events.add('admin:setRank', async (player, email, rank) => {
    if (!isAdmin(player, 'owner')) return;
    if (!RANKS.hasOwnProperty(rank)) return player.call('hud:notification', ['Rank invalid.', 'error']);

    const account = await db.queryOne('SELECT id FROM accounts WHERE email = ?', [email]);
    if (!account) return player.call('hud:notification', ['Cont negasit.', 'error']);

    await db.insert(
        `INSERT INTO admins (account_id, admin_rank, granted_by) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE admin_rank=?, is_active=1`,
        [account.id, rank, player.data.accountId, rank]
    );

    // Update live if online
    const target = mp.players.toArray().find(p => p.data && p.data.accountId === account.id);
    if (target) {
        target.data.adminRank  = rank;
        target.data.adminLevel = RANKS[rank];
        target.call('hud:notification', [`Rangul tau a fost setat la ${RANK_LABELS[rank]} de catre un admin.`, 'info']);
    }

    console.log(`[ADMIN] ${player.data.cnp} a setat randul ${rank} pentru ${email}`);
    player.call('hud:notification', [`Rang ${RANK_LABELS[rank]} setat pentru ${email}.`, 'success']);
});

// ── REMOVE ADMIN ─────────────────────────────────────────────
mp.events.add('admin:removeRank', async (player, email) => {
    if (!isAdmin(player, 'owner')) return;
    const account = await db.queryOne('SELECT id FROM accounts WHERE email = ?', [email]);
    if (!account) return player.call('hud:notification', ['Cont negasit.', 'error']);
    await db.update('UPDATE admins SET is_active = 0 WHERE account_id = ?', [account.id]);
    player.call('hud:notification', [`Rang admin eliminat pentru ${email}.`, 'success']);
});

// ── ANNOUNCE (server-wide message) ────────────────────────────
mp.events.add('admin:announce', (player, message) => {
    if (!isAdmin(player, 'moderator')) return;
    const tag = RANK_LABELS[player.data.adminRank] || '[ADMIN]';
    mp.players.forEach(p => {
        p.call('hud:notification', [`${tag} ANUNT: ${message}`, 'warning']);
    });
    console.log(`[ADMIN ANNOUNCE] ${message}`);
});

// ── NOCLIP / GOD MODE ────────────────────────────────────────
mp.events.add('admin:toggleGod', (player) => {
    if (!isAdmin(player, 'admin')) return;
    player.data.godMode = !player.data.godMode;
    player.call('admin:toggleGodClient', [player.data.godMode]);
    player.call('hud:notification', [player.data.godMode ? 'God Mode ON' : 'God Mode OFF', 'info']);
});

// ── LOAD ADMIN ON CHARACTER LOAD ─────────────────────────────
mp.events.add('character:load', async (player) => {
    await loadAdminData(player);
    if (player.data.adminRank) {
        const label = RANK_LABELS[player.data.adminRank];
        player.call('admin:setTag', [label, player.data.adminRank]);
        console.log(`[ADMIN] ${player.data.cnp} conectat cu rang ${player.data.adminRank}`);
    }
});

module.exports = { isAdmin, isTester, loadAdminData, RANKS, RANK_LABELS };
