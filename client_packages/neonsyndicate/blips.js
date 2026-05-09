// ── NEON SYNDICATE | MAP BLIPS ────────────────────────────────

const spawnedBlips = [];

/**
 * Create a minimap blip.
 * @param {number}  x
 * @param {number}  y
 * @param {number}  z
 * @param {number}  sprite     - GTA blip sprite ID
 * @param {number}  color      - GTA blip colour ID
 * @param {number}  scale      - Icon scale (default 0.8)
 * @param {string}  name       - Label shown in legend
 * @param {boolean} shortRange - True = only visible close-up
 */
function addBlip(x, y, z, sprite, color, scale, name, shortRange) {
    try {
        const blip = mp.blips.new(
            sprite,
            new mp.Vector3(x, y, z),
            {
                name:       name,
                color:      color,
                scale:      scale !== undefined ? scale : 0.8,
                shortRange: shortRange !== undefined ? shortRange : true
            }
        );
        spawnedBlips.push(blip);
        return blip;
    } catch (e) {}
}

// ── STATIC SHOWROOM BLIPS ─────────────────────────────────────
// Car showroom       — sprite 326 (car)    green  (colour 2)
addBlip(-49.5,    -1097.2,  26.4,  326, 2,  1.0, 'Showroom Auto',          false);
// Truck showroom     — sprite 477 (truck)  blue   (colour 4)
addBlip(-451.7,   -1600.3,  15.5,  477, 4,  1.0, 'Showroom Camioane',      false);
// Boat showroom      — sprite 427 (anchor) cyan   (colour 56)
addBlip(-782.4,   -1475.8,   0.4,  427, 56, 1.0, 'Showroom Ambarcatiuni',  false);
// Air showroom       — sprite 423 (plane)  blue   (colour 2)
addBlip(-1069.3,  -2658.6,  13.8,  423, 2,  1.0, 'Showroom Avioane',       false);

// ── BUSINESS SPRITE & COLOUR MAPS ────────────────────────────
const BUSINESS_SPRITES = {
    electronics:  67,
    pharmacy:     58,
    clothing_m:   73,
    clothing_f:   73,
    shoes:        73,
    mixed:        52,
    restaurant:   93,
    cafe:         93,
    barbershop:   71,
    salon:        71,
    hairdresser:  71,
    mechanic:     446,
    tuning:       446,
    showroom:     326,
    casino:       79,
    newspaper:    115
};

const BUSINESS_COLORS = {
    electronics:  6,
    pharmacy:     2,
    clothing_m:   8,
    clothing_f:   8,
    shoes:        8,
    mixed:        4,
    restaurant:   69,
    cafe:         40,
    barbershop:   0,
    salon:        8,
    hairdresser:  8,
    mechanic:     3,
    tuning:       3,
    showroom:     2,
    casino:       7,
    newspaper:    0
};

// ── DYNAMIC BLIPS FROM SERVER ─────────────────────────────────
mp.events.add('blips:receiveAll', (dataJSON) => {
    const data = JSON.parse(dataJSON);

    // Garages
    (data.garages || []).forEach(g => {
        addBlip(
            g.pos_x, g.pos_y, g.pos_z,
            g.blip_sprite || 357,
            g.blip_color  || 3,
            0.75,
            g.name,
            false
        );
    });

    // Legal jobs
    (data.jobs || []).forEach(j => {
        addBlip(
            j.spawn_x, j.spawn_y, j.spawn_z,
            j.blip_sprite || 280,
            j.blip_color  || 2,
            0.8,
            j.display_name,
            false
        );
    });

    // Businesses
    (data.businesses || []).forEach(b => {
        const sprite = BUSINESS_SPRITES[b.business_type] || b.blip_sprite || 52;
        const color  = BUSINESS_COLORS[b.business_type]  || b.blip_color  || 4;
        addBlip(
            b.pos_x, b.pos_y, b.pos_z,
            sprite, color, 0.7,
            b.name,
            true
        );
    });
});
