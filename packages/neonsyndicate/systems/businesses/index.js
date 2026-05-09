/**
 * Neon Syndicate – Business / Shop System (server-side)
 *
 * Colshapes are now created by the interaction system (interaction/index.js).
 * This module handles:
 *  - business:playerEnter   (internal from interaction) – send shop UI
 *  - business:getStock      (from client) – refresh stock
 *  - business:buyItem       (from client callRemote) – purchase flow
 *  - business:buy           (from client) – buy the whole business
 *  - business:setPrice      (owner) – update item sell price
 *  - business:restock       (owner) – buy more stock
 *  - business:getRevenue    (owner) – check earnings
 *  - business:withdrawRevenue (owner) – collect earnings
 *  - Daily tax tick
 */

'use strict';

const db = require('../../database/connection');
const { giveItem } = require('../inventory/index');

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function getCurrentWeight(charId) {
    const rows = await db.queryAll(
        `SELECT ci.quantity, i.weight
         FROM character_inventory ci
         LEFT JOIN items i ON i.name = ci.item_name
         WHERE ci.character_id = ?`,
        [charId]
    );
    return rows.reduce((sum, r) => sum + (r.weight || 0.1) * (r.quantity || 1), 0);
}

function notify(player, msg, type) {
    if (player && player.call) player.call('hud:notification', [msg, type || 'info']);
}

async function assignPhoneNumber(cnp) {
    for (let i = 0; i < 50; i++) {
        const num    = '07' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        const exists = await db.queryOne('SELECT cnp FROM characters WHERE phone_number = ?', [num]);
        if (!exists) {
            await db.update('UPDATE characters SET phone_number = ? WHERE cnp = ?', [num, cnp]);
            return num;
        }
    }
    return null;
}

// ── RESOURCE START: create colshapes ─────────────────────────────────────────
// Colshapes are owned by the interaction system. We only log here.
mp.events.add('onResourceStart', async () => {
    try {
        const businesses = await db.queryAll('SELECT COUNT(*) as cnt FROM businesses WHERE is_open = 1');
        const count = businesses[0] ? businesses[0].cnt : 0;
        console.log(`[BUSINESS] ${count} active businesses (colshapes managed by interaction system)`);
    } catch (err) {
        console.error(`[BUSINESS] onResourceStart error: ${err.message}`);
    }
});

// ── BUSINESS:PLAYERENTER (called by interaction system on E press) ────────────
mp.events.add('business:playerEnter', async (player, poi) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [poi.id]);
        if (!biz || !biz.is_open) return notify(player, 'Afacerea este inchisa.', 'warning');

        // Gender restriction check
        if (biz.gender_restrict && biz.gender_restrict !== 'none' && player.data.character) {
            const sex = player.data.character.sex;
            if (biz.gender_restrict === 'male'   && sex !== 0)
                return notify(player, 'Acest magazin este doar pentru barbati.', 'warning');
            if (biz.gender_restrict === 'female' && sex !== 1)
                return notify(player, 'Acest magazin este doar pentru femei.', 'warning');
        }

        const stock = await db.queryAll(
            `SELECT bs.item_name, bs.quantity, bs.sell_price,
                    i.display_name, i.weight, i.description, i.icon
             FROM business_stock bs
             LEFT JOIN items i ON i.name = bs.item_name
             WHERE bs.business_id = ? AND bs.quantity > 0
             ORDER BY i.display_name`,
            [biz.id]
        );

        const charRow = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [player.data.cnp]);

        player.call('business:openUI', [JSON.stringify({
            business: {
                id:           biz.id,
                name:         biz.name,
                type:         biz.business_type,
                isOwner:      biz.owner_cnp === player.data.cnp,
                isStateOwned: biz.is_state_owned,
                forSale:      biz.for_sale,
                salePrice:    biz.sale_price
            },
            stock,
            cash: charRow ? charRow.cash : 0
        })]);
    } catch (err) {
        console.error(`[BUSINESS] business:playerEnter error: ${err.message}`);
        notify(player, 'Eroare la deschiderea magazinului.', 'error');
    }
});

// ── BUSINESS:GETSTOCK (client refresh) ───────────────────────────────────────
mp.events.add('business:getStock', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
        if (!biz) return notify(player, 'Afacere negasita.', 'error');

        const stock = await db.queryAll(
            `SELECT bs.item_name, bs.quantity, bs.sell_price,
                    i.display_name, i.weight, i.description, i.icon
             FROM business_stock bs
             LEFT JOIN items i ON i.name = bs.item_name
             WHERE bs.business_id = ? AND bs.quantity > 0`,
            [bizId]
        );

        const charRow = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [player.data.cnp]);
        player.call('business:receiveStock', [JSON.stringify({ biz, stock, cash: charRow ? charRow.cash : 0 })]);
    } catch (err) {
        console.error(`[BUSINESS] business:getStock error: ${err.message}`);
    }
});

// ── BUSINESS:BUYITEM (from client callRemote) ─────────────────────────────────
mp.events.add('business:buyItem', async (player, bizId, itemName, quantity) => {
    if (!player.data || !player.data.cnp) return;
    quantity = Math.max(1, parseInt(quantity) || 1);

    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
        if (!biz || !biz.is_open) return notify(player, 'Magazinul este inchis.', 'error');

        // Gender restriction
        if (biz.gender_restrict && biz.gender_restrict !== 'none' && player.data.character) {
            const sex = player.data.character.sex;
            if (biz.gender_restrict === 'male'   && sex !== 0) return notify(player, 'Nu poti cumpara din acest magazin.', 'error');
            if (biz.gender_restrict === 'female' && sex !== 1) return notify(player, 'Nu poti cumpara din acest magazin.', 'error');
        }

        // Stock check
        const stockRow = await db.queryOne(
            'SELECT * FROM business_stock WHERE business_id = ? AND item_name = ?',
            [bizId, itemName]
        );
        if (!stockRow || stockRow.quantity < quantity)
            return notify(player, 'Stoc insuficient.', 'error');

        const totalCost = stockRow.sell_price * quantity;

        // Character data
        const charData = await db.queryOne(
            'SELECT id, cash, carry_base, carry_gym FROM characters WHERE cnp = ?',
            [player.data.cnp]
        );
        if (!charData || charData.cash < totalCost)
            return notify(player, `Bani insuficienti. Pret: $${totalCost.toLocaleString()}`, 'error');

        // Weight check
        const itemMeta    = await db.queryOne('SELECT weight FROM items WHERE name = ?', [itemName]);
        const addedWeight = (itemMeta ? itemMeta.weight : 0.1) * quantity;
        const curWeight   = await getCurrentWeight(charData.id);
        const maxCarry    = (charData.carry_base || 4.0) + (charData.carry_gym || 0.0);

        if (curWeight + addedWeight > maxCarry) {
            return notify(player, `Prea greu! Capacitate: ${maxCarry}kg, Curent: ${curWeight.toFixed(1)}kg.`, 'error');
        }

        // Deduct cash
        await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [totalCost, player.data.cnp]);

        // Reduce stock
        await db.update(
            'UPDATE business_stock SET quantity = quantity - ? WHERE business_id = ? AND item_name = ?',
            [quantity, bizId, itemName]
        );

        // Business revenue (70% of sale)
        await db.update(
            'UPDATE businesses SET bank_balance = bank_balance + ? WHERE id = ?',
            [totalCost * 0.7, bizId]
        );

        // Give item to player
        const success = await giveItem(charData.id, itemName, quantity);
        if (!success) {
            // Rollback cash + stock
            await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [totalCost, player.data.cnp]);
            await db.update(
                'UPDATE business_stock SET quantity = quantity + ? WHERE business_id = ? AND item_name = ?',
                [quantity, bizId, itemName]
            );
            return notify(player, 'Inventar plin. Nu s-a putut adauga itemul.', 'error');
        }

        // If buying a phone → assign number
        if (itemName.startsWith('phone_')) {
            await assignPhoneNumber(player.data.cnp);
        }

        notify(player, `Cumparat: ${itemName}`, 'success');
        player.call('inventory:itemAdded', [JSON.stringify({ item_name: itemName, quantity })]);

        console.log(`[BUSINESS] ${player.data.cnp} bought ${quantity}x ${itemName} from biz #${bizId} for $${totalCost}`);
    } catch (err) {
        console.error(`[BUSINESS] business:buyItem error: ${err.message}`);
        notify(player, 'Eroare la cumparare.', 'error');
    }
});

// ── BUSINESS:BUY (buy the whole business) ─────────────────────────────────────
mp.events.add('business:buy', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;

    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
        if (!biz || !biz.for_sale)  return notify(player, 'Afacerea nu este de vanzare.', 'error');
        if (biz.owner_cnp)          return notify(player, 'Afacerea are deja un proprietar.', 'error');
        if (biz.is_state_owned)     return notify(player, 'Afacerile de stat nu se vand.', 'error');

        const charData = await db.queryOne('SELECT cash, bank FROM characters WHERE cnp = ?', [player.data.cnp]);
        if (!charData || (charData.cash + charData.bank) < biz.sale_price) {
            return notify(player, `Bani insuficienti. Pret: $${biz.sale_price.toLocaleString()}`, 'error');
        }

        // Deduct bank first, then cash
        let remaining = biz.sale_price;
        if (charData.bank >= remaining) {
            await db.update('UPDATE characters SET bank = bank - ? WHERE cnp = ?', [remaining, player.data.cnp]);
        } else {
            const fromBank = charData.bank;
            const fromCash = remaining - fromBank;
            await db.update('UPDATE characters SET bank = 0, cash = cash - ? WHERE cnp = ?', [fromCash, player.data.cnp]);
        }

        await db.update('UPDATE businesses SET owner_cnp = ?, for_sale = 0 WHERE id = ?', [player.data.cnp, bizId]);
        notify(player, `Ai cumparat ${biz.name} pentru $${biz.sale_price.toLocaleString()}!`, 'success');
        player.call('business:closeMenu', []);
        console.log(`[BUSINESS] ${player.data.cnp} bought business #${bizId} (${biz.name})`);
    } catch (err) {
        console.error(`[BUSINESS] business:buy error: ${err.message}`);
        notify(player, 'Eroare la cumpararea afacerii.', 'error');
    }
});

// ── BUSINESS:SETPRICE (owner) ─────────────────────────────────────────────────
mp.events.add('business:setPrice', async (player, bizId, itemName, newPrice) => {
    if (!player.data || !player.data.cnp) return;
    try {
        const biz = await db.queryOne('SELECT owner_cnp FROM businesses WHERE id = ?', [bizId]);
        if (!biz || biz.owner_cnp !== player.data.cnp) return notify(player, 'Nu esti proprietarul.', 'error');
        newPrice = parseFloat(newPrice);
        if (isNaN(newPrice) || newPrice < 1) return notify(player, 'Pret invalid.', 'error');
        await db.update(
            'UPDATE business_stock SET sell_price = ? WHERE business_id = ? AND item_name = ?',
            [newPrice, bizId, itemName]
        );
        notify(player, `Pret actualizat: ${itemName} → $${newPrice}`, 'success');
    } catch (err) {
        console.error(`[BUSINESS] business:setPrice error: ${err.message}`);
    }
});

// ── BUSINESS:RESTOCK (owner) ──────────────────────────────────────────────────
mp.events.add('business:restock', async (player, bizId, itemName, quantity) => {
    if (!player.data || !player.data.cnp) return;
    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
        if (!biz || biz.owner_cnp !== player.data.cnp) return notify(player, 'Nu esti proprietarul.', 'error');

        quantity = Math.max(1, parseInt(quantity) || 10);
        const stock = await db.queryOne(
            'SELECT * FROM business_stock WHERE business_id = ? AND item_name = ?',
            [bizId, itemName]
        );
        if (!stock) return notify(player, 'Item negasit in stoc.', 'error');

        const restockCost = stock.buy_price * quantity;
        const charData    = await db.queryOne('SELECT cash FROM characters WHERE cnp = ?', [player.data.cnp]);
        if (!charData || charData.cash < restockCost)
            return notify(player, `Bani insuficienti. Cost: $${restockCost.toLocaleString()}`, 'error');

        await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [restockCost, player.data.cnp]);
        await db.update(
            `UPDATE business_stock
             SET quantity = LEAST(quantity + ?, max_quantity), last_restock = NOW()
             WHERE business_id = ? AND item_name = ?`,
            [quantity, bizId, itemName]
        );
        notify(player, `Stoc actualizat: +${quantity}x ${itemName} ($${restockCost.toLocaleString()})`, 'success');
    } catch (err) {
        console.error(`[BUSINESS] business:restock error: ${err.message}`);
    }
});

// ── BUSINESS:GETREVENUE (owner) ───────────────────────────────────────────────
mp.events.add('business:getRevenue', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;
    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
        if (!biz || biz.owner_cnp !== player.data.cnp) return;
        player.call('business:receiveRevenue', [JSON.stringify({ balance: biz.bank_balance, name: biz.name })]);
    } catch (err) {
        console.error(`[BUSINESS] business:getRevenue error: ${err.message}`);
    }
});

// ── BUSINESS:WITHDRAWREVENUE (owner) ─────────────────────────────────────────
mp.events.add('business:withdrawRevenue', async (player, bizId) => {
    if (!player.data || !player.data.cnp) return;
    try {
        const biz = await db.queryOne('SELECT * FROM businesses WHERE id = ?', [bizId]);
        if (!biz || biz.owner_cnp !== player.data.cnp) return;
        if (biz.bank_balance <= 0) return notify(player, 'Nu ai venituri de ridicat.', 'warning');

        const amount = biz.bank_balance;
        await db.update('UPDATE businesses SET bank_balance = 0 WHERE id = ?', [bizId]);
        await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [amount, player.data.cnp]);
        notify(player, `Ai ridicat $${amount.toFixed(2)} din ${biz.name}.`, 'success');
    } catch (err) {
        console.error(`[BUSINESS] business:withdrawRevenue error: ${err.message}`);
    }
});

// ── DAILY TAX TICK (every 24 hours) ──────────────────────────────────────────
setInterval(async () => {
    try {
        const businesses = await db.queryAll(
            'SELECT * FROM businesses WHERE owner_cnp IS NOT NULL AND is_state_owned = 0'
        );
        for (const biz of businesses) {
            const owner = await db.queryOne('SELECT cash, bank FROM characters WHERE cnp = ?', [biz.owner_cnp]);
            if (!owner) continue;

            const tax = biz.daily_tax || 0;
            if (tax <= 0) continue;

            if (owner.bank >= tax) {
                await db.update('UPDATE characters SET bank = bank - ? WHERE cnp = ?', [tax, biz.owner_cnp]);
            } else if (owner.cash >= tax) {
                await db.update('UPDATE characters SET cash = cash - ? WHERE cnp = ?', [tax, biz.owner_cnp]);
            } else {
                // Cannot pay – close the business
                await db.update('UPDATE businesses SET is_open = 0 WHERE id = ?', [biz.id]);
                console.log(`[BUSINESS] Business #${biz.id} (${biz.name}) closed: owner couldn't pay tax $${tax}`);
            }

            // Notify if owner is online
            const onlineOwner = mp.players.toArray().find(p => p.data && p.data.cnp === biz.owner_cnp);
            if (onlineOwner) {
                notify(onlineOwner, `Taxa zilnica $${tax} dedusa pentru ${biz.name}.`, 'info');
            }
        }
    } catch (err) {
        console.error(`[BUSINESS] Daily tax tick error: ${err.message}`);
    }
}, 24 * 60 * 60 * 1000);

module.exports = { getCurrentWeight, assignPhoneNumber };
