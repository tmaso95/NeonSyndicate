/**
 * Neon Syndicate – Admin System (server-side)
 *
 * Rank hierarchy (ascending power):
 *   tester < helper < moderator < admin < head_admin < co_owner < owner
 *
 * Features:
 *  - Chat commands via playerCommand event
 *  - Admin panel open / actions via admin:* events from client
 *  - Admin duty toggle (aduty), god mode, noclip, spectate
 *  - Ban / unban / setrank / kick with rank protection
 *  - Announce, weather, time, givemoney, giveveh, deleteveh, wanted, revive, freeze
 *  - Auto-loads admin rank on character load
 */

'use strict';

const db = require('../../database/connection');

// ── RANK TABLES ───────────────────────────────────────────────────────────────
const RANK_WEIGHTS = {
    tester:     1,
    helper:     2,
    moderator:  3,
    admin:      4,
    head_admin: 5,
    co_owner:   6,
    owner:      7
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

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Fetch admin rank string for a player, or null if not admin / inactive */
async function getAdminRank(player) {
    if (!player.data || !player.data.accountId) return null;
    const row = await db.queryOne(
        'SELECT admin_rank FROM admins WHERE account_id = ? AND is_active = 1',
        [player.data.accountId]
    );
    return row ? row.admin_rank : null;
}

/** Load and cache admin data onto player.data */
async function loadAdminData(player) {
    const rank = await getAdminRank(player);
    player.data.adminRank   = rank;
    player.data.adminWeight = rank ? (RANK_WEIGHTS[rank] || 0) : 0;
}

/** Returns true if player has at least `minRank` */
function isAdmin(player, minRank = 'tester') {
    if (!player.data) return false;
    const weight    = player.data.adminWeight || 0;
    const minWeight = RANK_WEIGHTS[minRank]  || 1;
    return weight >= minWeight;
}

/** Find a player by their RageMP numeric id */
function findPlayerById(id) {
    const numId = parseInt(id);
    if (isNaN(numId)) return null;
    return mp.players.toArray().find(p => p.id === numId) || null;
}

/** Protect: prevent action against equal or higher-ranked admin */
function rankProtected(actor, target) {
    if (!target.data) return false;
    return (target.data.adminWeight || 0) >= (actor.data.adminWeight || 0);
}

// ── LOAD ADMIN ON CHARACTER LOAD ─────────────────────────────────────────────
mp.events.add('character:load', async (player) => {
    try {
        await loadAdminData(player);
        if (player.data.adminRank) {
            const label = RANK_LABELS[player.data.adminRank] || '[ADMIN]';
            player.call('admin:setTag',   [label, player.data.adminRank]);
            console.log(`[ADMIN] ${player.data.cnp} logged in with rank ${player.data.adminRank}`);
        }
    } catch (err) {
        console.error(`[ADMIN] character:load admin setup error: ${err.message}`);
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// CHAT / COMMAND HANDLER
// ═════════════════════════════════════════════════════════════════════════════

mp.events.add('playerCommand', async (player, fullCommand) => {
    if (!player.data || !player.data.cnp) return;

    const parts   = fullCommand.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args    = parts.slice(1);

    try {
        switch (command) {

            // ── /tp [id] ──────────────────────────────────────────────────
            case 'tp': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                player.position = new mp.Vector3(
                    target.position.x + 2,
                    target.position.y,
                    target.position.z
                );
                player.dimension = target.dimension;
                notify(player, `Teleportat la ${args[0]}.`, 'info');
                break;
            }

            // ── /tphere [id] ─────────────────────────────────────────────
            case 'tphere': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                target.position = new mp.Vector3(
                    player.position.x + 2,
                    player.position.y,
                    player.position.z
                );
                target.dimension = player.dimension;
                notify(player, `Jucatorul ${args[0]} adus la tine.`, 'info');
                notify(target, 'Ai fost teleportat de un admin.', 'info');
                break;
            }

            // ── /heal [id?] ──────────────────────────────────────────────
            case 'heal': {
                if (!isAdmin(player, 'helper')) return notify(player, 'Acces interzis.', 'error');
                const target = args[0] ? findPlayerById(args[0]) : player;
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                await healPlayer(target);
                notify(player, `${args[0] ? 'Jucatorul ' + args[0] + ' a fost' : 'Ai fost'} vindecat.`, 'success');
                if (target !== player) notify(target, 'Ai fost vindecat de un admin.', 'success');
                break;
            }

            // ── /healall ─────────────────────────────────────────────────
            case 'healall': {
                if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
                for (const p of mp.players.toArray()) {
                    if (p.data && p.data.cnp) await healPlayer(p);
                }
                mp.players.forEach(p => notify(p, 'Toti jucatorii au fost vindecati de admin.', 'success'));
                console.log(`[ADMIN] ${player.data.cnp} healed all players`);
                break;
            }

            // ── /god ─────────────────────────────────────────────────────
            case 'god': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                player.data.godMode = !player.data.godMode;
                player.call('admin:toggleGodClient', [player.data.godMode]);
                notify(player, player.data.godMode ? 'God Mode ON' : 'God Mode OFF', 'info');
                break;
            }

            // ── /freeze [id] ─────────────────────────────────────────────
            case 'freeze': {
                if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                target.data = target.data || {};
                target.data.frozen = !target.data.frozen;
                target.call('admin:setFrozen', [target.data.frozen]);
                notify(player, `Jucatorul ${args[0]} ${target.data.frozen ? 'blocat' : 'deblocat'}.`, 'info');
                notify(target, target.data.frozen ? 'Ai fost blocat de un admin.' : 'Ai fost deblocat.', 'warning');
                break;
            }

            // ── /kick [id] [reason] ──────────────────────────────────────
            case 'kick': {
                if (!isAdmin(player, 'helper')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                if (rankProtected(player, target)) return notify(player, 'Nu poti da kick unui admin de rang egal/superior.', 'error');
                const reason = args.slice(1).join(' ') || 'Fara motiv';
                target.kick(`Kick: ${reason}`);
                notify(player, `Jucatorul ${args[0]} a fost kickat (${reason}).`, 'success');
                console.log(`[ADMIN] ${player.data.cnp} kicked player #${args[0]}: ${reason}`);
                break;
            }

            // ── /ban [id] [reason] ───────────────────────────────────────
            case 'ban': {
                if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                if (rankProtected(player, target)) return notify(player, 'Nu poti bana un admin de rang egal/superior.', 'error');
                const reason = args.slice(1).join(' ') || 'Fara motiv';
                const accId  = target.data && target.data.accountId;
                if (accId) {
                    await db.update('UPDATE accounts SET is_banned = 1, ban_reason = ? WHERE id = ?', [reason, accId]);
                }
                target.kick(`Banat: ${reason}`);
                notify(player, `Jucatorul ${args[0]} a fost banat (${reason}).`, 'success');
                console.log(`[ADMIN] ${player.data.cnp} banned account #${accId}: ${reason}`);
                break;
            }

            // ── /unban [email] ───────────────────────────────────────────
            case 'unban': {
                if (!isAdmin(player, 'head_admin')) return notify(player, 'Acces interzis.', 'error');
                const email    = args[0];
                if (!email) return notify(player, 'Foloseste: /unban <email>', 'error');
                const affected = await db.update(
                    'UPDATE accounts SET is_banned = 0, ban_reason = NULL WHERE email = ?',
                    [email]
                );
                if (affected) notify(player, `Cont ${email} a fost debanat.`, 'success');
                else          notify(player, 'Email negasit.', 'error');
                break;
            }

            // ── /setrank [email] [rank] ──────────────────────────────────
            case 'setrank': {
                if (!isAdmin(player, 'head_admin')) return notify(player, 'Acces interzis.', 'error');
                const [email, rank] = args;
                if (!email || !rank) return notify(player, 'Foloseste: /setrank <email> <rank>', 'error');
                if (!RANK_WEIGHTS[rank]) return notify(player, 'Rank invalid.', 'error');
                if ((RANK_WEIGHTS[rank] || 0) >= (player.data.adminWeight || 0)) {
                    return notify(player, 'Nu poti seta un rank egal sau superior rangului tau.', 'error');
                }
                const account = await db.queryOne('SELECT id FROM accounts WHERE email = ?', [email]);
                if (!account) return notify(player, 'Cont negasit.', 'error');

                await db.insert(
                    `INSERT INTO admins (account_id, admin_rank, granted_by)
                     VALUES (?,?,?)
                     ON DUPLICATE KEY UPDATE admin_rank = ?, is_active = 1`,
                    [account.id, rank, player.data.accountId, rank]
                );

                // Update live if target is online
                const onlineTarget = mp.players.toArray().find(p => p.data && p.data.accountId === account.id);
                if (onlineTarget) {
                    onlineTarget.data.adminRank   = rank;
                    onlineTarget.data.adminWeight = RANK_WEIGHTS[rank];
                    onlineTarget.call('admin:setTag', [RANK_LABELS[rank], rank]);
                    notify(onlineTarget, `Rangul tau a fost setat la ${RANK_LABELS[rank]}.`, 'info');
                }

                notify(player, `Rang ${RANK_LABELS[rank]} setat pentru ${email}.`, 'success');
                console.log(`[ADMIN] ${player.data.cnp} set rank ${rank} for ${email}`);
                break;
            }

            // ── /announce [message] ──────────────────────────────────────
            case 'announce': {
                if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
                const message = args.join(' ');
                if (!message) return notify(player, 'Foloseste: /announce <mesaj>', 'error');
                const tag = RANK_LABELS[player.data.adminRank] || '[ADMIN]';
                mp.players.forEach(p => {
                    notify(p, `${tag} ANUNT: ${message}`, 'warning');
                });
                console.log(`[ADMIN ANNOUNCE] ${player.data.cnp}: ${message}`);
                break;
            }

            // ── /setweather [type] ───────────────────────────────────────
            case 'setweather': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const validWeathers = ['CLEAR', 'RAIN', 'FOGGY', 'THUNDER', 'OVERCAST', 'CLOUDS', 'SMOG', 'SNOWLIGHT', 'BLIZZARD'];
                const weather = (args[0] || '').toUpperCase();
                if (!validWeathers.includes(weather)) {
                    return notify(player, `Weather invalid. Optiuni: ${validWeathers.join(', ')}`, 'error');
                }
                mp.world.weather = weather;
                mp.players.forEach(p => notify(p, `Vremea a fost schimbata: ${weather}`, 'info'));
                console.log(`[ADMIN] ${player.data.cnp} set weather: ${weather}`);
                break;
            }

            // ── /settime [hour] ──────────────────────────────────────────
            case 'settime': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const hour = parseInt(args[0]);
                if (isNaN(hour) || hour < 0 || hour > 23) {
                    return notify(player, 'Ora invalida (0-23).', 'error');
                }
                mp.world.time = { hour, minute: 0, second: 0 };
                notify(player, `Ora setata la ${hour}:00.`, 'success');
                console.log(`[ADMIN] ${player.data.cnp} set time: ${hour}:00`);
                break;
            }

            // ── /givemoney [id] [amount] ─────────────────────────────────
            case 'givemoney': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target || !target.data || !target.data.cnp) return notify(player, 'Jucator negasit.', 'error');
                const amount = parseInt(args[1]);
                if (isNaN(amount) || amount <= 0) return notify(player, 'Suma invalida.', 'error');
                await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [amount, target.data.cnp]);
                notify(target, `Ai primit $${amount.toLocaleString()} de la admin.`, 'success');
                notify(player, `$${amount.toLocaleString()} acordati lui ${args[0]}.`, 'success');
                console.log(`[ADMIN] ${player.data.cnp} gave $${amount} to ${target.data.cnp}`);
                break;
            }

            // ── /giveveh [model] ─────────────────────────────────────────
            case 'giveveh': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const modelName = args[0];
                if (!modelName) return notify(player, 'Foloseste: /giveveh <model>', 'error');
                const pos = player.position;
                const spawnPos = new mp.Vector3(pos.x + 5, pos.y, pos.z);
                try {
                    const veh = mp.vehicles.new(mp.joaat(modelName), spawnPos, {
                        heading:     player.heading,
                        numberPlate: 'ADMIN',
                        locked:      false,
                        engine:      false
                    });
                    veh.setVariable('adminSpawned', true);
                    notify(player, `Vehicul ${modelName} spawnat.`, 'success');
                    console.log(`[ADMIN] ${player.data.cnp} spawned vehicle: ${modelName}`);
                } catch (e) {
                    notify(player, `Model invalid: ${modelName}`, 'error');
                }
                break;
            }

            // ── /deleteveh ───────────────────────────────────────────────
            case 'deleteveh': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const pos      = player.position;
                const vehicles = mp.vehicles.toArray();
                let closest    = null;
                let closestD   = Infinity;
                for (const v of vehicles) {
                    const d = v.position.distanceTo(pos);
                    if (d < closestD) { closestD = d; closest = v; }
                }
                if (!closest || closestD > 10) return notify(player, 'Nu exista vehicul in apropiere.', 'error');
                closest.destroy();
                notify(player, 'Vehicul sters.', 'success');
                break;
            }

            // ── /spectate [id] ───────────────────────────────────────────
            case 'spectate': {
                if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                player.data.spectating = target.id;
                player.call('admin:startSpectate', [target.id]);
                notify(player, `Spectezi jucatorul ${args[0]}.`, 'info');
                break;
            }

            // ── /stopspectate ────────────────────────────────────────────
            case 'stopspectate': {
                if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
                player.data.spectating = null;
                player.call('admin:stopSpectate', []);
                notify(player, 'Ai oprit spectarea.', 'info');
                break;
            }

            // ── /wanted [id] [level] ─────────────────────────────────────
            case 'wanted': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const target = findPlayerById(args[0]);
                if (!target || !target.data || !target.data.cnp) return notify(player, 'Jucator negasit.', 'error');
                const level = Math.max(0, Math.min(5, parseInt(args[1]) || 0));
                await db.update('UPDATE characters SET wanted_level = ? WHERE cnp = ?', [level, target.data.cnp]);
                target.call('hud:updateWanted', [level]);
                notify(player, `Wanted level setat la ${level} pentru jucatorul ${args[0]}.`, 'success');
                break;
            }

            // ── /revive [id?] ────────────────────────────────────────────
            case 'revive': {
                if (!isAdmin(player, 'helper')) return notify(player, 'Acces interzis.', 'error');
                const target = args[0] ? findPlayerById(args[0]) : player;
                if (!target) return notify(player, 'Jucator negasit.', 'error');
                target.health = 200;
                target.call('player:revive', []);
                notify(player, `Jucatorul ${args[0] || 'tu'} a fost reviat.`, 'success');
                if (target !== player) notify(target, 'Ai fost reviat de un admin.', 'success');
                break;
            }

            // ── /aduty ───────────────────────────────────────────────────
            case 'aduty': {
                if (!isAdmin(player, 'tester')) return notify(player, 'Acces interzis.', 'error');
                player.data.onDuty = !player.data.onDuty;
                const dutyLabel = player.data.onDuty ? RANK_LABELS[player.data.adminRank] : null;
                player.call('admin:setDuty', [player.data.onDuty, dutyLabel]);
                notify(player, player.data.onDuty ? 'Admin duty ON' : 'Admin duty OFF', 'info');
                console.log(`[ADMIN] ${player.data.cnp} toggled duty: ${player.data.onDuty}`);
                break;
            }

            // ── /goto [x] [y] [z] ───────────────────────────────────────
            case 'goto': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                const x = parseFloat(args[0]);
                const y = parseFloat(args[1]);
                const z = parseFloat(args[2]);
                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    return notify(player, 'Foloseste: /goto <x> <y> <z>', 'error');
                }
                player.position = new mp.Vector3(x, y, z);
                notify(player, `Teleportat la (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}).`, 'info');
                break;
            }

            // ── /noclip ──────────────────────────────────────────────────
            case 'noclip': {
                if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
                player.data.noclip = !player.data.noclip;
                player.call('admin:toggleNoclip', [player.data.noclip]);
                notify(player, player.data.noclip ? 'Noclip ON' : 'Noclip OFF', 'info');
                break;
            }

            default:
                // Not an admin command – ignore silently
                break;
        }
    } catch (err) {
        console.error(`[ADMIN] Command /${command} error: ${err.message}`);
        notify(player, 'Eroare la executarea comenzii.', 'error');
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL EVENTS (from browser / CEF)
// ═════════════════════════════════════════════════════════════════════════════

// ── OPEN ADMIN PANEL ─────────────────────────────────────────────────────────
mp.events.add('admin:openPanel', async (player) => {
    if (!isAdmin(player, 'tester')) return notify(player, 'Acces interzis.', 'error');

    try {
        const players = mp.players.toArray().map(p => ({
            id:     p.id,
            name:   p.data && p.data.character
                        ? `${p.data.character.firstname} ${p.data.character.lastname}`
                        : 'Loading...',
            cnp:    p.data && p.data.cnp  ? p.data.cnp          : '---',
            ping:   p.ping,
            rank:   p.data && p.data.adminRank ? p.data.adminRank : null,
            onDuty: p.data && p.data.onDuty    ? p.data.onDuty   : false
        }));

        player.call('admin:receivePanel', [JSON.stringify({
            myRank:   player.data.adminRank,
            myWeight: player.data.adminWeight,
            players
        })]);
    } catch (err) {
        console.error(`[ADMIN] admin:openPanel error: ${err.message}`);
    }
});

// ── PANEL ACTION: KICK ───────────────────────────────────────────────────────
mp.events.add('admin:kick', async (player, targetId, reason) => {
    if (!isAdmin(player, 'helper')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target) return notify(player, 'Jucator negasit.', 'error');
    if (rankProtected(player, target)) return notify(player, 'Nu poti da kick unui admin de rang egal/superior.', 'error');
    target.kick(`Kick: ${reason || 'Fara motiv'}`);
    notify(player, `Jucatorul ${targetId} kickat.`, 'success');
    console.log(`[ADMIN] ${player.data.cnp} kicked #${targetId}: ${reason}`);
});

// ── PANEL ACTION: BAN ─────────────────────────────────────────────────────────
mp.events.add('admin:ban', async (player, targetId, reason) => {
    if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target) return notify(player, 'Jucator negasit.', 'error');
    if (rankProtected(player, target)) return notify(player, 'Nu poti bana un admin de rang egal/superior.', 'error');
    const accId = target.data && target.data.accountId;
    if (accId) {
        await db.update('UPDATE accounts SET is_banned = 1, ban_reason = ? WHERE id = ?', [reason || 'Ban admin', accId]);
    }
    target.kick(`Banat: ${reason || 'Fara motiv'}`);
    notify(player, `Jucatorul ${targetId} banat.`, 'success');
    console.log(`[ADMIN] ${player.data.cnp} banned #${targetId}: ${reason}`);
});

// ── PANEL ACTION: UNBAN ──────────────────────────────────────────────────────
mp.events.add('admin:unban', async (player, email) => {
    if (!isAdmin(player, 'head_admin')) return notify(player, 'Acces interzis.', 'error');
    if (!email) return notify(player, 'Email necesar.', 'error');
    const affected = await db.update(
        'UPDATE accounts SET is_banned = 0, ban_reason = NULL WHERE email = ?',
        [email]
    );
    if (affected) notify(player, `Cont ${email} debanat.`, 'success');
    else          notify(player, 'Email negasit.', 'error');
});

// ── PANEL ACTION: GIVE MONEY ─────────────────────────────────────────────────
mp.events.add('admin:giveMoney', async (player, targetId, amount) => {
    if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target || !target.data || !target.data.cnp) return notify(player, 'Jucator negasit.', 'error');
    const amt = parseInt(amount);
    if (isNaN(amt) || amt <= 0) return notify(player, 'Suma invalida.', 'error');
    await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [amt, target.data.cnp]);
    notify(target, `Ai primit $${amt.toLocaleString()} de la admin.`, 'success');
    notify(player, `$${amt.toLocaleString()} trimisi lui ${targetId}.`, 'success');
});

// ── PANEL ACTION: HEAL ───────────────────────────────────────────────────────
mp.events.add('admin:heal', async (player, targetId) => {
    if (!isAdmin(player, 'helper')) return notify(player, 'Acces interzis.', 'error');
    const target = (targetId !== undefined && targetId !== null && targetId !== -1)
        ? findPlayerById(targetId)
        : player;
    if (!target) return notify(player, 'Jucator negasit.', 'error');
    await healPlayer(target);
    notify(player, `Jucatorul ${target.id} vindecat.`, 'success');
    if (target !== player) notify(target, 'Ai fost vindecat de un admin.', 'success');
});

// ── PANEL ACTION: TELEPORT TO PLAYER ─────────────────────────────────────────
mp.events.add('admin:tpToPlayer', (player, targetId) => {
    if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target) return notify(player, 'Jucator negasit.', 'error');
    player.position = new mp.Vector3(
        target.position.x + 2,
        target.position.y,
        target.position.z
    );
    player.dimension = target.dimension;
    notify(player, `Teleportat la jucatorul ${targetId}.`, 'info');
});

// ── PANEL ACTION: SPECTATE ───────────────────────────────────────────────────
mp.events.add('admin:spectate', (player, targetId) => {
    if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target) return notify(player, 'Jucator negasit.', 'error');
    player.data.spectating = target.id;
    player.call('admin:startSpectate', [target.id]);
    notify(player, `Spectezi jucatorul ${targetId}.`, 'info');
});

// ── PANEL ACTION: SET WANTED ─────────────────────────────────────────────────
mp.events.add('admin:setWanted', async (player, targetId, level) => {
    if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target || !target.data || !target.data.cnp) return notify(player, 'Jucator negasit.', 'error');
    const lvl = Math.max(0, Math.min(5, parseInt(level) || 0));
    await db.update('UPDATE characters SET wanted_level = ? WHERE cnp = ?', [lvl, target.data.cnp]);
    target.call('hud:updateWanted', [lvl]);
    notify(player, `Wanted level setat la ${lvl} pentru jucatorul ${targetId}.`, 'success');
});

// ── PANEL ACTION: ANNOUNCE ───────────────────────────────────────────────────
mp.events.add('admin:announce', (player, message) => {
    if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
    if (!message) return;
    const tag = RANK_LABELS[player.data.adminRank] || '[ADMIN]';
    mp.players.forEach(p => notify(p, `${tag} ANUNT: ${message}`, 'warning'));
    console.log(`[ADMIN ANNOUNCE] ${player.data.cnp}: ${message}`);
});

// ── PANEL ACTION: TOGGLE GOD ─────────────────────────────────────────────────
mp.events.add('admin:toggleGod', (player) => {
    if (!isAdmin(player, 'admin')) return notify(player, 'Acces interzis.', 'error');
    player.data.godMode = !player.data.godMode;
    player.call('admin:toggleGodClient', [player.data.godMode]);
    notify(player, player.data.godMode ? 'God Mode ON' : 'God Mode OFF', 'info');
});

// ── PANEL ACTION: SET RANK ───────────────────────────────────────────────────
mp.events.add('admin:setRank', async (player, email, rank) => {
    if (!isAdmin(player, 'head_admin')) return notify(player, 'Acces interzis.', 'error');
    if (!RANK_WEIGHTS[rank]) return notify(player, 'Rank invalid.', 'error');
    if ((RANK_WEIGHTS[rank] || 0) >= (player.data.adminWeight || 0)) {
        return notify(player, 'Nu poti seta un rank egal sau superior rangului tau.', 'error');
    }
    const account = await db.queryOne('SELECT id FROM accounts WHERE email = ?', [email]);
    if (!account) return notify(player, 'Cont negasit.', 'error');

    await db.insert(
        `INSERT INTO admins (account_id, admin_rank, granted_by)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE admin_rank = ?, is_active = 1`,
        [account.id, rank, player.data.accountId, rank]
    );

    const onlineTarget = mp.players.toArray().find(p => p.data && p.data.accountId === account.id);
    if (onlineTarget) {
        onlineTarget.data.adminRank   = rank;
        onlineTarget.data.adminWeight = RANK_WEIGHTS[rank];
        onlineTarget.call('admin:setTag', [RANK_LABELS[rank], rank]);
        notify(onlineTarget, `Rangul tau a fost setat la ${RANK_LABELS[rank]}.`, 'info');
    }

    notify(player, `Rang ${RANK_LABELS[rank]} setat pentru ${email}.`, 'success');
    console.log(`[ADMIN] ${player.data.cnp} set rank ${rank} for ${email}`);
});

// ── PANEL ACTION: FREEZE ─────────────────────────────────────────────────────
mp.events.add('admin:freeze', (player, targetId) => {
    if (!isAdmin(player, 'moderator')) return notify(player, 'Acces interzis.', 'error');
    const target = findPlayerById(targetId);
    if (!target) return notify(player, 'Jucator negasit.', 'error');
    target.data = target.data || {};
    target.data.frozen = !target.data.frozen;
    target.call('admin:setFrozen', [target.data.frozen]);
    notify(player, `Jucatorul ${targetId} ${target.data.frozen ? 'blocat' : 'deblocat'}.`, 'info');
    notify(target, target.data.frozen ? 'Ai fost blocat.' : 'Ai fost deblocat.', 'warning');
});

// ── GENERIC COMMAND RELAY (from browser panel) ────────────────────────────────
mp.events.add('admin:command', async (player, command, ...args) => {
    if (!isAdmin(player, 'tester')) return;
    // Re-use the playerCommand handler
    const fullCommand = [command, ...args].join(' ');
    mp.events.call('playerCommand', player, fullCommand);
});

// ═════════════════════════════════════════════════════════════════════════════
// INTERNAL UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

function notify(player, msg, type) {
    if (player && player.call) {
        player.call('hud:notification', [msg, type || 'info']);
    }
}

async function healPlayer(target) {
    target.health = 200;
    target.armour = 100;
    if (target.data && target.data.cnp) {
        await db.update(
            'UPDATE characters SET hunger = 100, thirst = 100, stamina = 100, stress = 0 WHERE cnp = ?',
            [target.data.cnp]
        );
    }
    target.call('survival:updateStats', [JSON.stringify({ hunger: 100, thirst: 100, stamina: 100, stress: 0 })]);
}

module.exports = { isAdmin, getAdminRank, loadAdminData, RANK_WEIGHTS, RANK_LABELS };
