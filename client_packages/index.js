// ── NEON SYNDICATE | CLIENT ENTRY POINT ──────────────────────
// Load order matters: cursor must be first (provides global helpers),
// then interaction & HUD (UI foundations), then feature modules.

require('./neonsyndicate/cursor');
require('./neonsyndicate/interaction');
require('./neonsyndicate/hud');
require('./neonsyndicate/blips');
require('./neonsyndicate/auth');
require('./neonsyndicate/character');
require('./neonsyndicate/vehicles');
require('./neonsyndicate/showroom');
require('./neonsyndicate/garages');
require('./neonsyndicate/inventory');
require('./neonsyndicate/phone');
require('./neonsyndicate/admin');
require('./neonsyndicate/police');
require('./neonsyndicate/businesses');
require('./neonsyndicate/survival');
require('./neonsyndicate/gym');
