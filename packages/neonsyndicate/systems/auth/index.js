const db         = require('../../database/connection');
const { hashPassword, verifyPassword } = require('../../utils/hash');
const { isValidEmail, isValidPassword, getPlayerIP } = require('../../utils/validators');

// Show auth UI to connecting player
mp.events.add('playerJoin', (player) => {
    player.data = {};
    player.call('auth:showUI');
});

// ── REGISTER ────────────────────────────────────────────────
mp.events.add('auth:register', async (player, email, password) => {
    try {
        if (!isValidEmail(email))    return player.call('auth:error', ['Email invalid.']);
        if (!isValidPassword(password)) return player.call('auth:error', ['Parola trebuie sa aiba minim 6 caractere.']);

        const ip = getPlayerIP(player);

        // One account per IP
        const byIP = await db.queryOne('SELECT id FROM accounts WHERE registered_ip = ?', [ip]);
        if (byIP) return player.call('auth:error', ['Exista deja un cont inregistrat de pe acest IP.']);

        // One account per email
        const byEmail = await db.queryOne('SELECT id FROM accounts WHERE email = ?', [email.toLowerCase()]);
        if (byEmail) return player.call('auth:error', ['Acest email este deja inregistrat.']);

        const hashed = await hashPassword(password);
        const accountId = await db.insert(
            'INSERT INTO accounts (email, password, registered_ip, last_ip) VALUES (?,?,?,?)',
            [email.toLowerCase(), hashed, ip, ip]
        );

        player.data.accountId = accountId;
        mp.console.logInfo(`[AUTH] New account #${accountId} registered: ${email} IP:${ip}`);
        player.call('auth:success', ['register', accountId]);
        player.call('character:showCreation');
    } catch (err) {
        mp.console.logError(`[AUTH] Register error: ${err.message}`);
        player.call('auth:error', ['Eroare server. Incearca din nou.']);
    }
});

// ── LOGIN ────────────────────────────────────────────────────
mp.events.add('auth:login', async (player, email, password) => {
    try {
        if (!isValidEmail(email))    return player.call('auth:error', ['Email invalid.']);
        if (!isValidPassword(password)) return player.call('auth:error', ['Parola prea scurta.']);

        const ip = getPlayerIP(player);
        const account = await db.queryOne(
            'SELECT id, password, is_banned, ban_reason FROM accounts WHERE email = ?',
            [email.toLowerCase()]
        );

        if (!account) return player.call('auth:error', ['Email sau parola incorecta.']);
        if (account.is_banned) return player.call('auth:error', [`Cont banat: ${account.ban_reason || 'fara motiv specificat'}.`]);

        const valid = await verifyPassword(password, account.password);
        if (!valid) return player.call('auth:error', ['Email sau parola incorecta.']);

        // Update last IP
        await db.update('UPDATE accounts SET last_ip = ?, last_login = NOW() WHERE id = ?', [ip, account.id]);

        // Check if account already logged in
        const online = mp.players.toArray().find(p => p.data && p.data.accountId === account.id && p !== player);
        if (online) return player.call('auth:error', ['Contul este deja conectat.']);

        player.data.accountId = account.id;

        // Load character
        const character = await db.queryOne(
            'SELECT * FROM characters WHERE account_id = ?',
            [account.id]
        );

        if (!character) {
            mp.console.logInfo(`[AUTH] Login OK #${account.id}, no character -> creation`);
            player.call('auth:success', ['login', account.id]);
            player.call('character:showCreation');
        } else {
            mp.console.logInfo(`[AUTH] Login OK #${account.id}, loading character ${character.cnp}`);
            player.call('auth:success', ['login', account.id]);
            mp.events.call('character:load', player, character);
        }
    } catch (err) {
        mp.console.logError(`[AUTH] Login error: ${err.message}`);
        player.call('auth:error', ['Eroare server. Incearca din nou.']);
    }
});
