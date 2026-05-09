const db = require('../../database/connection');

// Active pursuits: cnp -> {officers, startTime}
const activePursuits = new Map();

// ── GET OFFICER DUTY STATUS ───────────────────────────────────
function isOnDuty(player) {
    return player.data && player.data.onDuty === 'police';
}

function isEMSOnDuty(player) {
    return player.data && player.data.onDuty === 'ems';
}

function isSWATOnDuty(player) {
    return player.data && player.data.onDuty === 'swat';
}

// ── GO ON DUTY ────────────────────────────────────────────────
mp.events.add('police:onDuty', async (player, unit) => {
    if (!player.data || !player.data.cnp) return;
    const char = await db.queryOne('SELECT job_name FROM characters WHERE cnp = ?', [player.data.cnp]);
    const allowed = ['politie', 'ems', 'swat', 'pompieri'];
    if (!char || !allowed.includes(char.job_name)) {
        return player.call('hud:notification', ['Nu ai un job care permite intrarea in serviciu.', 'error']);
    }

    const dutyType = unit || char.job_name;
    player.data.onDuty = dutyType;
    player.call('hud:notification', [`Esti acum in serviciu: ${dutyType.toUpperCase()}`, 'success']);
    player.call('police:dutyChanged', [true, dutyType]);

    // Spawn duty vehicle & uniform
    if (dutyType === 'politie') {
        player.call('police:applyUniform', ['police']);
    } else if (dutyType === 'swat') {
        player.call('police:applyUniform', ['swat']);
    } else if (dutyType === 'ems') {
        player.call('police:applyUniform', ['ems']);
    }
});

mp.events.add('police:offDuty', (player) => {
    if (!player.data) return;
    const prev = player.data.onDuty;
    player.data.onDuty = null;
    player.call('police:dutyChanged', [false, prev]);
    player.call('hud:notification', ['Esti off duty.', 'info']);
});

// ── MDT: SEARCH PERSON ────────────────────────────────────────
mp.events.add('police:searchPerson', async (player, cnp) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return player.call('hud:notification', ['Nu esti in serviciu.', 'error']);

    const char = await db.queryOne(`
        SELECT c.firstname, c.lastname, c.cnp, c.age, c.sex, c.wanted_level,
               c.criminal_record, c.has_driving_license, c.has_weapon_license,
               c.is_jailed, c.jail_time, c.fingerprint, c.phone_number
        FROM characters c WHERE c.cnp = ?`, [cnp]
    );
    if (!char) return player.call('police:mdtResult', [JSON.stringify({ error: 'CNP negasit in sistem.' })]);

    const warrants = await db.queryAll(
        'SELECT * FROM police_warrants WHERE suspect_cnp = ? AND is_active = 1', [cnp]
    );
    const reports = await db.queryAll(
        'SELECT * FROM police_reports WHERE suspect_cnp = ? ORDER BY created_at DESC LIMIT 10', [cnp]
    );

    player.call('police:mdtResult', [JSON.stringify({ type: 'person', char, warrants, reports })]);
});

// ── MDT: SEARCH VEHICLE ───────────────────────────────────────
mp.events.add('police:searchVehicle', async (player, vinOrPlate) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return;

    const veh = await db.queryOne(`
        SELECT v.vin, v.plate, v.is_stolen, v.is_impounded,
               vm.display_name, vm.model_hash,
               c.firstname, c.lastname, c.cnp as owner_cnp
        FROM vehicles v
        JOIN vehicle_models vm ON vm.id = v.model_id
        JOIN characters c ON c.cnp = v.owner_cnp
        WHERE v.vin = ? OR v.plate = ?`, [vinOrPlate, vinOrPlate]
    );

    if (!veh) return player.call('police:mdtResult', [JSON.stringify({ error: 'Vehicul negasit.' })]);
    player.call('police:mdtResult', [JSON.stringify({ type: 'vehicle', veh })]);
});

// ── ARREST ───────────────────────────────────────────────────
mp.events.add('police:arrest', async (player, targetId, reason, jailMinutes) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return player.call('hud:notification', ['Nu esti in serviciu.', 'error']);

    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return player.call('hud:notification', ['Jucator negasit.', 'error']);

    jailMinutes = Math.max(1, Math.min(120, parseInt(jailMinutes) || 10));

    await db.update('UPDATE characters SET is_jailed = 1, jail_time = ?, wanted_level = 0 WHERE cnp = ?',
        [jailMinutes, target.data.cnp]);

    // Log report
    await db.insert(
        'INSERT INTO police_reports (report_type, officer_cnp, suspect_cnp, description, jail_time) VALUES (?,?,?,?,?)',
        ['arrest', player.data.cnp, target.data.cnp, reason || 'Arest fara motiv specificat', jailMinutes]
    );

    // Update criminal record
    const existing = await db.queryOne('SELECT criminal_record FROM characters WHERE cnp = ?', [target.data.cnp]);
    const record   = existing && existing.criminal_record ? JSON.parse(existing.criminal_record) : [];
    record.push({ date: new Date().toISOString(), officer: player.data.cnp, reason, jail: jailMinutes });
    await db.update('UPDATE characters SET criminal_record = ? WHERE cnp = ?', [JSON.stringify(record), target.data.cnp]);

    // Teleport to jail
    target.position = new mp.Vector3(1691.0, 2558.0, 45.5);
    target.dimension = 0;
    target.call('hud:notification', [`Ai fost arestat: ${reason}. Timp: ${jailMinutes} minute.`, 'error']);
    target.call('police:arrested', [jailMinutes]);

    player.call('hud:notification', [`${target.data.cnp} arestat cu ${jailMinutes} min.`, 'success']);
    console.log(`[POLICE] ${player.data.cnp} a arestat ${target.data.cnp}: ${reason}`);
});

// ── FINE / AMENDA ─────────────────────────────────────────────
mp.events.add('police:fine', async (player, targetId, amount, reason) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return;
    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return;

    amount = Math.max(100, parseInt(amount) || 500);
    await db.update('UPDATE characters SET cash = GREATEST(0, cash - ?) WHERE cnp = ?', [amount, target.data.cnp]);
    await db.insert(
        'INSERT INTO police_reports (report_type, officer_cnp, suspect_cnp, description, fine_amount) VALUES (?,?,?,?,?)',
        ['ticket', player.data.cnp, target.data.cnp, reason || 'Amenda', amount]
    );

    target.call('hud:notification', [`Ai primit o amenda de $${amount}: ${reason}`, 'error']);
    player.call('hud:notification', [`Amenda de $${amount} aplicata lui ${target.data.cnp}.`, 'success']);
});

// ── ISSUE WARRANT ─────────────────────────────────────────────
mp.events.add('police:issueWarrant', async (player, cnp, reason, type) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return;
    const char = await db.queryOne('SELECT cnp FROM characters WHERE cnp = ?', [cnp]);
    if (!char) return player.call('hud:notification', ['CNP negasit.', 'error']);

    await db.insert(
        'INSERT INTO police_warrants (suspect_cnp, issued_by, reason, warrant_type) VALUES (?,?,?,?)',
        [cnp, player.data.cnp, reason, type || 'arrest']
    );
    player.call('hud:notification', [`Mandat emis pentru ${cnp}.`, 'success']);

    // Notify target if online
    const target = mp.players.toArray().find(p => p.data && p.data.cnp === cnp);
    if (target) {
        target.call('hud:notification', ['Politia a emis un mandat pe numele tau.', 'warning']);
        target.call('hud:updateWanted', [Math.min(5, (target.data.wanted || 0) + 1)]);
    }
});

// ── JAIL TIMER (every minute) ─────────────────────────────────
setInterval(async () => {
    const players = mp.players.toArray();
    for (const p of players) {
        if (!p.data || !p.data.cnp) continue;
        const char = await db.queryOne('SELECT is_jailed, jail_time FROM characters WHERE cnp = ?', [p.data.cnp]);
        if (!char || !char.is_jailed) continue;

        if (char.jail_time <= 1) {
            await db.update('UPDATE characters SET is_jailed = 0, jail_time = 0 WHERE cnp = ?', [p.data.cnp]);
            p.position = new mp.Vector3(1849.0, 2584.0, 46.0);
            p.call('hud:notification', ['Ai fost eliberat din inchisoare.', 'success']);
            p.call('police:released');
        } else {
            await db.update('UPDATE characters SET jail_time = jail_time - 1 WHERE cnp = ?', [p.data.cnp]);
            p.call('police:jailTimerTick', [char.jail_time - 1]);
        }
    }
}, 60000);

// ── OPEN MDT ─────────────────────────────────────────────────
mp.events.add('police:openMDT', (player) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return player.call('hud:notification', ['Nu esti in serviciu.', 'error']);
    player.call('police:showMDT');
});

// ── SET WANTED LEVEL ─────────────────────────────────────────
mp.events.add('police:setWanted', async (player, targetId, level) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return;
    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return;
    level = Math.max(0, Math.min(5, parseInt(level)));
    await db.update('UPDATE characters SET wanted_level = ? WHERE cnp = ?', [level, target.data.cnp]);
    target.call('hud:updateWanted', [level]);
    player.call('hud:notification', [`Wanted setat la ${level} pentru ${target.data.cnp}.`, 'success']);
});

// ── IMPOUND VEHICLE ───────────────────────────────────────────
mp.events.add('police:impound', async (player, vin) => {
    if (!isOnDuty(player) && !isSWATOnDuty(player)) return;
    await db.update('UPDATE vehicles SET is_impounded = 1 WHERE vin = ?', [vin]);
    player.call('hud:notification', [`Vehiculul ${vin} a fost ridicat.`, 'success']);
});

// ── EMS: REVIVE PLAYER ────────────────────────────────────────
mp.events.add('ems:revive', async (player, targetId) => {
    if (!isEMSOnDuty(player)) return player.call('hud:notification', ['Nu esti EMS in serviciu.', 'error']);

    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return player.call('hud:notification', ['Jucator negasit.', 'error']);

    await db.update('UPDATE characters SET is_in_coma = 0, coma_start = NULL, health = 100 WHERE cnp = ?', [target.data.cnp]);
    await db.update('UPDATE character_injuries SET injury_head=0, injury_chest=0, injury_left_arm=0, injury_right_arm=0, injury_left_leg=0, injury_right_leg=0 WHERE character_id = (SELECT id FROM characters WHERE cnp=?)', [target.data.cnp]);

    target.health = 180;
    target.call('ems:revived');
    target.call('hud:notification', ['Ai fost resuscitat de EMS!', 'success']);
    player.call('hud:notification', [`${target.data.cnp} a fost resuscitat.`, 'success']);
});

// ── EMS: TREAT INJURY ─────────────────────────────────────────
mp.events.add('ems:treatInjury', async (player, targetId, bodyPart) => {
    if (!isEMSOnDuty(player)) return;
    const target = mp.players.at(targetId);
    if (!target || !target.data || !target.data.cnp) return;

    const allowed = ['injury_head','injury_chest','injury_left_arm','injury_right_arm','injury_left_leg','injury_right_leg'];
    if (!allowed.includes(bodyPart)) return;

    const charId = await db.queryOne('SELECT id FROM characters WHERE cnp = ?', [target.data.cnp]);
    if (!charId) return;

    await db.update(`UPDATE character_injuries SET ${bodyPart} = 0 WHERE character_id = ?`, [charId.id]);
    target.call('ems:injuryTreated', [bodyPart]);
    target.call('hud:notification', [`Rana la ${bodyPart.replace('injury_','')} tratata de EMS.`, 'success']);
    player.call('hud:notification', [`Rana tratata.`, 'success']);
});

// ── COMA TIMER (every 30 seconds check) ──────────────────────
setInterval(async () => {
    const players = mp.players.toArray();
    for (const p of players) {
        if (!p.data || !p.data.cnp) continue;
        const char = await db.queryOne('SELECT is_in_coma, coma_start FROM characters WHERE cnp = ?', [p.data.cnp]);
        if (!char || !char.is_in_coma) continue;

        const comaStart = new Date(char.coma_start).getTime();
        const elapsed   = (Date.now() - comaStart) / 60000; // minutes

        if (elapsed >= 30) {
            // Auto respawn
            await db.update('UPDATE characters SET is_in_coma=0, coma_start=NULL, health=100, hunger=GREATEST(hunger-10,0), thirst=GREATEST(thirst-10,0) WHERE cnp=?', [p.data.cnp]);
            await db.update('UPDATE character_injuries SET injury_head=0,injury_chest=0,injury_left_arm=0,injury_right_arm=0,injury_left_leg=0,injury_right_leg=0 WHERE character_id=(SELECT id FROM characters WHERE cnp=?)', [p.data.cnp]);
            p.position  = new mp.Vector3(340.0, -1395.0, 32.5); // Hospital
            p.dimension = 0;
            p.health    = 150;
            p.call('ems:respawned');
            p.call('hud:notification', ['Ai fost transportat la spital dupa 30 de minute.', 'warning']);
        }
    }
}, 30000);

module.exports = { isOnDuty, isEMSOnDuty, isSWATOnDuty };
