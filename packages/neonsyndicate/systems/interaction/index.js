/**
 * Neon Syndicate – Interaction / POI System (server-side)
 *
 * Responsibilities:
 *  - On resource start: load all POIs from DB + hardcoded showrooms.
 *    Create a mp.colshapes.newSphere for each with .poi metadata.
 *  - playerEnterColshape  → tell client to show "Press E" hint.
 *  - playerExitColshape   → tell client to hide hint.
 *  - interaction:keyE     → route to the correct system event.
 */

'use strict';

const db = require('../../database/connection');

// ── STATIC SHOWROOM POIs ─────────────────────────────────────────────────────
const SHOWROOM_POIS = [
    { type: 'showroom', category: 'car',   x: -49.5,   y: -1097.2, z: 26.4,  name: 'Premium Auto'     },
    { type: 'showroom', category: 'truck', x: -451.7,  y: -1600.3, z: 15.5,  name: 'Commercial Trucks' },
    { type: 'showroom', category: 'boat',  x: -782.4,  y: -1475.8, z: 0.4,   name: 'Marina Boats'      },
    { type: 'showroom', category: 'air',   x: -1069.3, y: -2658.6, z: 13.8,  name: 'LSIA Aviation'     }
];

// ── HELPER: create a colshape with .poi metadata ─────────────────────────────
function createPOI(poiData) {
    const col = mp.colshapes.newSphere(
        new mp.Vector3(poiData.x, poiData.y, poiData.z),
        poiData.radius || 3.0
    );
    col.poi = poiData;
    return col;
}

// ── RESOURCE START: load every POI type ─────────────────────────────────────
mp.events.add('onResourceStart', async () => {
    let totalPOIs = 0;

    // 1. Hardcoded showrooms
    for (const sr of SHOWROOM_POIS) {
        createPOI(sr);
        totalPOIs++;
    }

    // 2. Garages from DB
    try {
        const garages = await db.queryAll(
            'SELECT id, name, garage_type, pos_x, pos_y, pos_z FROM garages WHERE is_active = 1'
        );
        for (const g of garages) {
            createPOI({
                type:      'garage',
                id:        g.id,
                name:      g.name,
                category:  g.garage_type,
                x:         g.pos_x,
                y:         g.pos_y,
                z:         g.pos_z,
                radius:    3.0
            });
            totalPOIs++;
        }
        console.log(`[INTERACTION] Loaded ${garages.length} garage POIs`);
    } catch (err) {
        console.error(`[INTERACTION] Failed to load garages: ${err.message}`);
    }

    // 3. Businesses from DB
    try {
        const businesses = await db.queryAll(
            'SELECT id, name, business_type, pos_x, pos_y, pos_z FROM businesses WHERE is_open = 1'
        );
        for (const biz of businesses) {
            createPOI({
                type:          'business',
                id:            biz.id,
                name:          biz.name,
                category:      biz.business_type,
                x:             biz.pos_x,
                y:             biz.pos_y,
                z:             biz.pos_z,
                radius:        2.5
            });
            totalPOIs++;
        }
        console.log(`[INTERACTION] Loaded ${businesses.length} business POIs`);
    } catch (err) {
        console.error(`[INTERACTION] Failed to load businesses: ${err.message}`);
    }

    // 4. Job locations from DB
    try {
        const jobs = await db.queryAll(
            'SELECT id, name, display_name, job_type, spawn_x, spawn_y, spawn_z FROM jobs'
        );
        for (const job of jobs) {
            createPOI({
                type:      'job',
                id:        job.id,
                name:      job.display_name,
                jobName:   job.name,
                category:  job.job_type,
                x:         job.spawn_x,
                y:         job.spawn_y,
                z:         job.spawn_z,
                radius:    3.0
            });
            totalPOIs++;
        }
        console.log(`[INTERACTION] Loaded ${jobs.length} job POIs`);
    } catch (err) {
        console.error(`[INTERACTION] Failed to load jobs: ${err.message}`);
    }

    console.log(`[INTERACTION] Total POIs registered: ${totalPOIs}`);
});

// ── PLAYER ENTERS A POI COLSHAPE ─────────────────────────────────────────────
mp.events.add('playerEnterColshape', (player, colshape) => {
    if (!colshape.poi) return;                       // not a POI colshape
    if (!player.data || !player.data.cnp) return;   // not authenticated

    player.data.nearPOI = colshape.poi;

    // Send the POI descriptor to the client so it can display the hint UI
    player.call('interaction:nearPOI', [JSON.stringify(colshape.poi)]);
});

// ── PLAYER LEAVES A POI COLSHAPE ────────────────────────────────────────────
mp.events.add('playerExitColshape', (player, colshape) => {
    if (!colshape.poi) return;
    if (!player.data) return;

    // Only clear if we are leaving the colshape that set the nearPOI
    if (player.data.nearPOI && player.data.nearPOI === colshape.poi) {
        player.data.nearPOI = null;
    }

    player.call('interaction:leavePOI', []);
});

// ── PLAYER PRESSES E ──────────────────────────────────────────────────────────
mp.events.add('interaction:keyE', (player) => {
    if (!player.data || !player.data.nearPOI) return;

    const poi = player.data.nearPOI;

    switch (poi.type) {
        case 'showroom':
            // Opens vehicle catalog filtered by category
            mp.events.call('showroom:open', player, poi.category);
            break;

        case 'garage':
            // Opens garage UI with the player's vehicles
            mp.events.call('garage:playerInteract', player, {
                id:       poi.id,
                name:     poi.name,
                category: poi.category
            });
            break;

        case 'business':
            // Opens the shop / business UI
            mp.events.call('business:playerEnter', player, poi);
            break;

        case 'job':
            // Opens the job interaction UI
            mp.events.call('job:playerInteract', player, poi);
            break;

        default:
            console.warn(`[INTERACTION] Unknown POI type: ${poi.type}`);
    }
});

// ── job:playerInteract stub (so the event always exists) ─────────────────────
// The jobs system may override this; we provide a sensible default.
mp.events.add('job:playerInteract', (player, poi) => {
    if (!player.data || !player.data.cnp) return;
    // Forward the list of available jobs for this location
    db.queryAll('SELECT name, display_name, description, job_type, pay_base FROM jobs WHERE id = ?', [poi.id])
        .then(jobs => {
            if (!jobs || jobs.length === 0) return;
            player.call('job:receiveInfo', [JSON.stringify(jobs[0])]);
        })
        .catch(err => console.error(`[INTERACTION] job:playerInteract DB error: ${err.message}`));
});
