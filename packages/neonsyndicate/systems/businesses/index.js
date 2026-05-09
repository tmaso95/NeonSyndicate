const db = require('../../database/connection');

// Cache business colshapes
const businessColshapes = new Map(); // colshape id -> business

mp.events.add('onResourceStart', async () => {
    const businesses = await db.queryAll('SELECT * FROM businesses WHERE is_open = 1');
    for (const biz of businesses) {
        const col = mp.colshapes.newSphere(new mp.Vector3(biz.pos_x, biz.pos_y, biz.pos_z), 2.5);
        col.businessId   = biz.id;
        col.businessData = biz;
    }
    mp.console.logInfo(`[BUSINESS] Loaded ${businesses.length} businesses`);
});

mp.events.add('playerEnterColshape', (player, colshape) => {
    if (!colshape.businessId || !player.data || !player.data.cnp) return;
    const biz = colshape.businessData;

    // Gender restriction
    if (biz.gender_restrict !== 'none' && player.data.character) {
        const sex = player.data.character.sex;
        if (biz.gender_restrict === 'male'   && sex !== 0) return player.call('hud:notification', ['Acest magazin este doar pentru barbati.', 'warning']);
        if (biz.gender_restrict === 'female' && sex !== 1) return player.call('hud:notification', ['Acest magazin este doar pentru femei.', 'warning']);
    }

    player.call('business:showMenu', [JSON.stringify({
        id:          biz.id,
        name:        biz.name,
        type:        biz.business_type,
        isOwner:     biz.owner_cnp === player.data.cnp,
        isStateOwned: biz.is_state_owned,
        forSale:     biz.for_sale,
        salePrice:   biz.sale_price
    })]);
});

mp.events.add('playerExitColshape', (player, colshape) => {
    if (!colshape.businessId) return;
    player.call('business:closeMenu');
});

// ── GET STOCK ─────────────────────────────────────────────────
mp.events.add('business:getStock', async (player, bizId) => {
    const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
    if (!biz) return;

    const stock = await db.queryAll(
        `SELECT bs.item_name, bs.quantity, bs.sell_price,
                i.display_name, i.weight, i.description, i.icon
         FROM business_stock bs
         LEFT JOIN items i ON i.name = bs.item_name
         WHERE bs.business_id = ? AND bs.quantity > 0`,
        [bizId]
    );

    const charData = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [player.data.cnp]);
    player.call('business:receiveStock', [JSON.stringify({ biz, stock, cash: charData ? charData.cash : 0 })]);
});

// ── BUY ITEM ──────────────────────────────────────────────────
mp.events.add('business:buyItem', async (player, bizId, itemName, quantity) => {
    if (!player.data || !player.data.cnp) return;
    quantity = Math.max(1, parseInt(quantity) || 1);

    const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
    if (!biz || !biz.is_open) return player.call('hud:notification', ['Magazinul este inchis.', 'error']);

    // Gender restriction check
    if (biz.gender_restrict !== 'none' && player.data.character) {
        const sex = player.data.character.sex;
        if (biz.gender_restrict === 'male'   && sex !== 0) return player.call('hud:notification', ['Nu poti cumpara din acest magazin.', 'error']);
        if (biz.gender_restrict === 'female' && sex !== 1) return player.call('hud:notification', ['Nu poti cumpara din acest magazin.', 'error']);
    }

    const stockRow = await db.queryOne(
        'SELECT * FROM business_stock WHERE business_id = ? AND item_name = ?',
        [bizId, itemName]
    );
    if (!stockRow || stockRow.quantity < quantity) return player.call('hud:notification', ['Stoc insuficient.', 'error']);

    const totalCost = stockRow.sell_price * quantity;
    const charData  = await db.queryOne('SELECT id, cash, carry_base, carry_gym FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!charData || charData.cash < totalCost) return player.call('hud:notification', ['Bani insuficienti.', 'error']);

    // Check inventory weight
    const item = await db.queryOne('SELECT weight FROM items WHERE name = ?', [itemName]);
    const itemWeight = item ? item.weight * quantity : 0.1 * quantity;
    const maxCarry   = (charData.carry_base || 4.0) + (charData.carry_gym || 0.0);
    const currentWeight = await getCurrentWeight(charData.id);

    if (currentWeight + itemWeight > maxCarry) {
        return player.call('hud:notification', [`Prea greu! Capacitate: ${maxCarry}kg, Curent: ${currentWeight.toFixed(1)}kg.`, 'error']);
    }

    // Deduct cash + update stock
    await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [totalCost, player.data.cnp]);
    await db.update('UPDATE business_stock SET quantity = quantity - ? WHERE business_id = ? AND item_name = ?',
        [quantity, bizId, itemName]);

    // Business revenue
    await db.update('UPDATE businesses SET bank_balance = bank_balance + ? WHERE id = ?', [totalCost * 0.7, bizId]);

    // Give item
    const { giveItem } = require('../inventory/index');
    const success = await giveItem(charData.id, itemName, quantity);
    if (!success) {
        await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [totalCost, player.data.cnp]);
        return player.call('hud:notification', ['Inventar plin.', 'error']);
    }

    // Special: phone gives phone number
    if (itemName.startsWith('phone_')) {
        await assignPhoneNumber(player.data.cnp);
    }

    player.call('hud:notification', [`Ai cumparat ${quantity}x ${itemName} pentru $${totalCost}.`, 'success']);
});

async function getCurrentWeight(charId) {
    const rows = await db.queryAll(
        `SELECT ci.quantity, i.weight FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ?`, [charId]
    );
    return rows.reduce((sum, r) => sum + (r.weight || 0.1) * (r.quantity || 1), 0);
}

async function assignPhoneNumber(cnp) {
    // Generate unique 10-digit phone number
    for (let i = 0; i < 50; i++) {
        const num = '07' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        const exists = await db.queryOne('SELECT cnp FROM characters WHERE phone_number = ?', [num]);
        if (!exists) {
            await db.update('UPDATE characters SET phone_number = ? WHERE cnp = ?', [num, cnp]);
            return num;
        }
    }
}

// ── BUY BUSINESS ─────────────────────────────────────────────
mp.events.add('business:buy', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;

    const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
    if (!biz || !biz.for_sale) return player.call('hud:notification', ['Afacerea nu e de vanzare.', 'error']);
    if (biz.owner_cnp) return player.call('hud:notification', ['Afacerea are deja un proprietar.', 'error']);
    if (biz.is_state_owned) return player.call('hud:notification', ['Afacerea de stat nu se vinde.', 'error']);

    const charData = await db.queryOne('SELECT cash, bank FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!charData || (charData.cash + charData.bank) < biz.sale_price) {
        return player.call('hud:notification', ['Bani insuficienti.', 'error']);
    }

    // Deduct from bank first, then cash
    let remaining = biz.sale_price;
    if (charData.bank >= remaining) {
        await db.update('UPDATE characters SET bank = bank - ? WHERE cnp = ?', [remaining, player.data.cnp]);
    } else {
        const fromBank = charData.bank;
        const fromCash = remaining - fromBank;
        await db.update('UPDATE characters SET bank = 0, cash = cash - ? WHERE cnp = ?', [fromCash, player.data.cnp]);
    }

    await db.update('UPDATE businesses SET owner_cnp = ?, for_sale = 0 WHERE id = ?', [player.data.cnp, bizId]);
    player.call('hud:notification', [`Ai cumparat ${biz.name} pentru $${biz.sale_price.toLocaleString()}!`, 'success']);
    player.call('business:closeMenu');
});

// ── OWNER: SET PRICE ──────────────────────────────────────────
mp.events.add('business:setPrice', async (player, bizId, itemName, newPrice) => {
    if (!player.data || !player.data.cnp) return;
    const biz = await db.queryOne('SELECT owner_cnp FROM businesses WHERE id = ?', [bizId]);
    if (!biz || biz.owner_cnp !== player.data.cnp) return player.call('hud:notification', ['Nu esti proprietarul.', 'error']);

    newPrice = parseFloat(newPrice);
    if (isNaN(newPrice) || newPrice < 1) return player.call('hud:notification', ['Pret invalid.', 'error']);

    await db.update('UPDATE business_stock SET sell_price = ? WHERE business_id = ? AND item_name = ?',
        [newPrice, bizId, itemName]);
    player.call('hud:notification', [`Pret actualizat: ${itemName} -> $${newPrice}`, 'success']);
});

// ── OWNER: RESTOCK ────────────────────────────────────────────
mp.events.add('business:restock', async (player, bizId, itemName, quantity) => {
    if (!player.data || !player.data.cnp) return;
    const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
    if (!biz || biz.owner_cnp !== player.data.cnp) return player.call('hud:notification', ['Nu esti proprietarul.', 'error']);

    quantity = Math.max(1, parseInt(quantity) || 10);
    const stock = await db.queryOne('SELECT * FROM business_stock WHERE business_id = ? AND item_name = ?', [bizId, itemName]);
    if (!stock) return player.call('hud:notification', ['Item negasit in stoc.', 'error']);

    const restockCost = stock.buy_price * quantity;
    const charData    = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!charData || charData.cash < restockCost) return player.call('hud:notification', [`Bani insuficienti. Cost reaprovizionare: $${restockCost}`, 'error']);

    await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [restockCost, player.data.cnp]);
    await db.update(
        'UPDATE business_stock SET quantity = LEAST(quantity + ?, max_quantity), last_restock = NOW() WHERE business_id = ? AND item_name = ?',
        [quantity, bizId, itemName]
    );
    player.call('hud:notification', [`Stoc actualizat: +${quantity}x ${itemName} ($${restockCost})`, 'success']);
});

// ── OWNER: GET REVENUE ────────────────────────────────────────
mp.events.add('business:getRevenue', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;
    const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
    if (!biz || biz.owner_cnp !== player.data.cnp) return;
    player.call('business:receiveRevenue', [JSON.stringify({ balance: biz.bank_balance, name: biz.name })]);
});

mp.events.add('business:withdrawRevenue', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;
    const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
    if (!biz || biz.owner_cnp !== player.data.cnp) return;
    if (biz.bank_balance <= 0) return player.call('hud:notification', ['Nu ai venituri de ridicat.', 'warning']);

    const amount = biz.bank_balance;
    await db.update('UPDATE businesses SET bank_balance = 0 WHERE id = ?', [bizId]);
    await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [amount, player.data.cnp]);
    player.call('hud:notification', [`Ai ridicat $${amount.toFixed(2)} din afacere.`, 'success']);
});

// ── DAILY TAX (midnight tick) ─────────────────────────────────
setInterval(async () => {
    const businesses = await db.queryAll('SELECT * FROM businesses WHERE owner_cnp IS NOT NULL AND is_state_owned = 0');
    for (const biz of businesses) {
        const owner = await db.queryOne('SELECT cash, bank FROM characters WHERE cnp = ?', [biz.owner_cnp]);
        if (!owner) continue;

        const tax = biz.daily_tax;
        if (owner.bank >= tax) {
            await db.update('UPDATE characters SET bank = bank - ? WHERE cnp = ?', [tax, biz.owner_cnp]);
        } else if (owner.cash >= tax) {
            await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [tax, biz.owner_cnp]);
        } else {
            // Mark for closure
            await db.update('UPDATE businesses SET is_open = 0 WHERE id = ?', [biz.id]);
        }

        // Notify if online
        const player = mp.players.toArray().find(p => p.data && p.data.cnp === biz.owner_cnp);
        if (player) player.call('hud:notification', [`Taxa zilnica $${tax} dedusa pentru ${biz.name}.`, 'info']);
    }
}, 24 * 60 * 60 * 1000);

module.exports = { getCurrentWeight, assignPhoneNumber };
