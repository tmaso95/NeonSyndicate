const db      = require('../../database/connection');
const { generateCNP } = require('../../utils/generators');
const { isValidName, isValidAge } = require('../../utils/validators');

// Default clothing per gender  (component: [drawable, texture])
const DEFAULT_CLOTHES = {
    male: {
        undershirt: [15, 0],
        top:        [15, 0],
        legs:       [21, 0],
        shoes:      [10, 0]
    },
    female: {
        undershirt: [19, 0],
        top:        [5,  0],
        legs:       [15, 0],
        shoes:      [3,  0]
    }
};

// ── CREATE CHARACTER ─────────────────────────────────────────
mp.events.add('character:create', async (player, dataJSON) => {
    try {
        if (!player.data || !player.data.accountId) {
            return player.call('character:error', ['Sesiune invalida. Reconecteaza-te.']);
        }

        let data;
        try { data = JSON.parse(dataJSON); }
        catch { return player.call('character:error', ['Date invalide trimise.'  ]); }

        const { firstname, lastname, sex, age, shapeFather, shapeMother, shapeMix,
                skinFather, skinMother, skinMix, eyeColor, hairStyle, hairColor,
                hairHighlight, faceFeatures, faceOverlays } = data;

        if (!isValidName(firstname)) return player.call('character:error', ['Prenume invalid (2-32 litere).']);
        if (!isValidName(lastname))  return player.call('character:error', ['Nume invalid (2-32 litere).']);
        if (!isValidAge(age))        return player.call('character:error', ['Varsta trebuie sa fie intre 18-70.']);

        // Only one character per account
        const existing = await db.queryOne('SELECT id FROM characters WHERE account_id = ?', [player.data.accountId]);
        if (existing) return player.call('character:error', ['Contul are deja un caracter.']);

        const cnp = await generateCNP();

        const charId = await db.insert(`
            INSERT INTO characters
            (account_id, cnp, firstname, lastname, sex, age,
             shape_first, shape_second, shape_mix, skin_first, skin_second, skin_mix,
             eye_color, hair_style, hair_color, hair_highlight, face_features, face_overlays)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                player.data.accountId, cnp,
                firstname.trim(), lastname.trim(), sex ? 1 : 0, age,
                shapeFather || 0, shapeMother || 0, shapeMix   || 0.5,
                skinFather  || 0, skinMother  || 0, skinMix    || 0.5,
                eyeColor    || 0, hairStyle   || 0, hairColor  || 0, hairHighlight || 0,
                JSON.stringify(faceFeatures  || []),
                JSON.stringify(faceOverlays  || {})
            ]
        );

        // Insert default clothes
        const clothes = sex ? DEFAULT_CLOTHES.female : DEFAULT_CLOTHES.male;
        for (const [slot, [drawable, texture]] of Object.entries(clothes)) {
            await db.insert(
                'INSERT INTO character_clothes (character_id, slot, drawable, texture) VALUES (?,?,?,?)',
                [charId, slot, drawable, texture]
            );
        }

        // Give starter items
        await db.insert('INSERT INTO character_inventory (character_id, item_name, quantity, slot_index) VALUES (?,?,?,?)', [charId, 'phone', 1, 0]);
        await db.insert('INSERT INTO character_inventory (character_id, item_name, quantity, slot_index) VALUES (?,?,?,?)', [charId, 'id_card', 1, 1]);
        await db.insert('INSERT INTO character_inventory (character_id, item_name, quantity, slot_index) VALUES (?,?,?,?)', [charId, 'wallet', 1, 2]);

        console.log(`[CHAR] Created character ${firstname} ${lastname} CNP:${cnp}`);

        const character = await db.queryOne('SELECT * FROM characters WHERE id = ?', [charId]);
        mp.events.call('character:load', player, character);
    } catch (err) {
        console.error(`[CHAR] Create error: ${err.message}`);
        player.call('character:error', ['Eroare server la creare caracter.']);
    }
});

// ── LOAD CHARACTER ────────────────────────────────────────────
mp.events.add('character:load', async (player, character) => {
    try {
        player.data.character = character;
        player.data.cnp       = character.cnp;

        // Apply position
        player.spawn(new mp.Vector3(character.pos_x, character.pos_y, character.pos_z));
        player.heading   = character.pos_h;
        player.health    = Math.min(200, Math.max(100, character.health));
        player.armour    = character.armor;
        player.dimension = character.dimension || 0;

        // Apply appearance
        const model = character.sex === 1 ? mp.joaat('mp_f_freemode_01') : mp.joaat('mp_m_freemode_01');
        player.model = model;

        player.call('character:applyAppearance', [JSON.stringify({
            shapeFirst:    character.shape_first,
            shapeSecond:   character.shape_second,
            shapeMix:      character.shape_mix,
            skinFirst:     character.skin_first,
            skinSecond:    character.skin_second,
            skinMix:       character.skin_mix,
            eyeColor:      character.eye_color,
            hairStyle:     character.hair_style,
            hairColor:     character.hair_color,
            hairHighlight: character.hair_highlight,
            faceFeatures:  character.face_features || [],
            faceOverlays:  character.face_overlays  || {}
        })]);

        // Load clothes
        const clothes = await db.queryAll('SELECT slot, drawable, texture FROM character_clothes WHERE character_id = ?', [character.id]);
        player.call('character:applyClothes', [JSON.stringify(clothes)]);

        // hud:show carries the initial stats so the browser can apply them once ready
        player.call('hud:show', [JSON.stringify({
            name:     `${character.firstname} ${character.lastname}`,
            cnp:       character.cnp,
            level:     character.level,
            cash:      character.cash,
            bank:      character.bank,
            job:       character.job_name || 'Somer',
            playTime:  character.play_time
        })]);

        // Send map blips (garages + legal jobs + open businesses)
        const [garages, jobs, businesses] = await Promise.all([
            db.queryAll('SELECT name, garage_type, pos_x, pos_y, pos_z, blip_sprite, blip_color FROM garages WHERE is_active = 1'),
            db.queryAll('SELECT display_name, job_type, spawn_x, spawn_y, spawn_z, blip_sprite, blip_color FROM jobs WHERE job_type = "legal"'),
            db.queryAll('SELECT name, business_type, pos_x, pos_y, pos_z, blip_sprite, blip_color FROM businesses WHERE is_open = 1')
        ]);
        player.call('blips:receiveAll', [JSON.stringify({ garages, jobs, businesses })]);

        console.log(`[CHAR] Loaded ${character.firstname} ${character.lastname} for account #${player.data.accountId}`);
    } catch (err) {
        console.error(`[CHAR] Load error: ${err.message}`);
    }
});

// ── SAVE CHARACTER ────────────────────────────────────────────
async function saveCharacter(player) {
    if (!player.data || !player.data.character) return;
    try {
        const pos = player.position;
        await db.update(`
            UPDATE characters SET
                health = ?, armor = ?, pos_x = ?, pos_y = ?, pos_z = ?, pos_h = ?,
                real_time = real_time + ?, last_seen = NOW()
            WHERE cnp = ?`,
            [
                player.health, player.armour,
                pos.x, pos.y, pos.z, player.heading,
                Math.floor((Date.now() - (player.data.joinTimestamp || Date.now())) / 60000),
                player.data.cnp
            ]
        );
    } catch (err) {
        console.error(`[CHAR] Save error: ${err.message}`);
    }
}

mp.events.add('playerQuit', (player) => {
    saveCharacter(player);
});

mp.events.add('playerReady', (player) => {
    player.data = player.data || {};
    player.data.joinTimestamp = Date.now();
});

// ── PLAY TIME TICK (every 60s) ────────────────────────────────
setInterval(async () => {
    const players = mp.players.toArray();
    for (const player of players) {
        if (!player.data || !player.data.cnp) continue;
        try {
            await db.update('UPDATE characters SET play_time = play_time + 1 WHERE cnp = ?', [player.data.cnp]);
            if (player.data.character) player.data.character.play_time++;
        } catch { /* silent */ }
    }
}, 60000);

// ── CLIENT: Request own stats ─────────────────────────────────
mp.events.add('character:requestStats', async (player) => {
    if (!player.data || !player.data.cnp) return;
    const c = await db.queryOne('SELECT level, experience, play_time, real_time, cash, bank FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (c) player.call('character:receiveStats', [JSON.stringify(c)]);
});

// ── GIVE MONEY (utility) ─────────────────────────────────────
async function giveCash(cnp, amount) {
    return db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [amount, cnp]);
}

async function takeCash(cnp, amount) {
    const c = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [cnp]);
    if (!c || c.cash < amount) return false;
    await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [amount, cnp]);
    return true;
}

async function giveXP(player, amount) {
    if (!player.data || !player.data.cnp) return;
    const c = await db.queryOne('SELECT level, experience FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!c) return;
    const newXP    = c.experience + amount;
    const newLevel = Math.floor(1 + Math.sqrt(newXP / 500));
    await db.update('UPDATE characters SET experience = ?, level = ? WHERE cnp = ?', [newXP, newLevel, player.data.cnp]);
    if (newLevel > c.level) {
        player.call('hud:notification', [`Ai avansat la nivelul ${newLevel}!`, 'success']);
    }
}

module.exports = { saveCharacter, giveCash, takeCash, giveXP };
