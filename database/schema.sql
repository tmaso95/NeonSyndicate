-- ============================================================
--  NEON SYNDICATE | BLACKRIDGE CITY - DATABASE SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS neonsyndicate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE neonsyndicate;

-- ============================================================
--  ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    registered_ip   VARCHAR(45) NOT NULL,
    last_ip         VARCHAR(45) NOT NULL,
    is_banned       TINYINT(1) NOT NULL DEFAULT 0,
    ban_reason      VARCHAR(255) DEFAULT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  CHARACTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS characters (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id      INT UNSIGNED NOT NULL,
    cnp             VARCHAR(8) NOT NULL UNIQUE,
    firstname       VARCHAR(32) NOT NULL,
    lastname        VARCHAR(32) NOT NULL,
    sex             TINYINT(1) NOT NULL DEFAULT 0,   -- 0 male, 1 female
    age             TINYINT UNSIGNED NOT NULL DEFAULT 25,

    -- Appearance (GTA Online freemode)
    shape_first     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    shape_second    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    shape_mix       FLOAT NOT NULL DEFAULT 0.5,
    skin_first      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    skin_second     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    skin_mix        FLOAT NOT NULL DEFAULT 0.5,
    eye_color       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    hair_style      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    hair_color      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    hair_highlight  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    face_features   JSON DEFAULT NULL,
    face_overlays   JSON DEFAULT NULL,

    -- Stats
    level           SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    experience      INT UNSIGNED NOT NULL DEFAULT 0,
    play_time       INT UNSIGNED NOT NULL DEFAULT 0,   -- minutes in-game
    real_time       INT UNSIGNED NOT NULL DEFAULT 0,   -- real-world minutes

    -- Finance
    cash            INT UNSIGNED NOT NULL DEFAULT 2500,
    bank            INT UNSIGNED NOT NULL DEFAULT 5000,

    -- Job & Faction
    job_name        VARCHAR(32) DEFAULT NULL,
    gang_id         INT UNSIGNED DEFAULT NULL,
    gang_rank       TINYINT UNSIGNED NOT NULL DEFAULT 0,

    -- Housing
    house_id        INT UNSIGNED DEFAULT NULL,

    -- Status
    health          FLOAT NOT NULL DEFAULT 200.0,
    armor           FLOAT NOT NULL DEFAULT 0.0,
    is_dead         TINYINT(1) NOT NULL DEFAULT 0,
    is_jailed       TINYINT(1) NOT NULL DEFAULT 0,
    jail_time       INT UNSIGNED NOT NULL DEFAULT 0,   -- minutes remaining
    wanted_level    TINYINT UNSIGNED NOT NULL DEFAULT 0,

    -- Last position
    pos_x           FLOAT NOT NULL DEFAULT 425.174,
    pos_y           FLOAT NOT NULL DEFAULT -979.466,
    pos_z           FLOAT NOT NULL DEFAULT 30.113,
    pos_h           FLOAT NOT NULL DEFAULT 90.0,
    dimension       INT UNSIGNED NOT NULL DEFAULT 0,

    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  CHARACTER CLOTHES (equipped items)
-- ============================================================
CREATE TABLE IF NOT EXISTS character_clothes (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id    INT UNSIGNED NOT NULL,
    slot            VARCHAR(24) NOT NULL,   -- head,mask,top,undershirt,jacket,vest,legs,shoes,gloves,accessories,bag,armor
    drawable        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    texture         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY uq_char_slot (character_id, slot)
) ENGINE=InnoDB;

-- ============================================================
--  VEHICLE MODELS (catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_models (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    model_hash      VARCHAR(64) NOT NULL UNIQUE,
    display_name    VARCHAR(64) NOT NULL,
    category        VARCHAR(24) NOT NULL,  -- car, motorcycle, bicycle, truck, boat, plane, helicopter
    price           INT UNSIGNED NOT NULL DEFAULT 0,
    has_rear_trunk  TINYINT(1) NOT NULL DEFAULT 1,
    has_front_trunk TINYINT(1) NOT NULL DEFAULT 0,
    trunk_capacity  SMALLINT UNSIGNED NOT NULL DEFAULT 20,

    -- Custom handling overrides (NULL = use GTA default)
    handling_mass           FLOAT DEFAULT NULL,
    handling_initial_drag   FLOAT DEFAULT NULL,
    handling_max_vel        FLOAT DEFAULT NULL,
    handling_acceleration   FLOAT DEFAULT NULL,
    handling_braking        FLOAT DEFAULT NULL,
    handling_traction_curve_max FLOAT DEFAULT NULL,
    handling_extra          JSON DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
--  OWNED VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vin             VARCHAR(17) NOT NULL UNIQUE,       -- NS-XXXXXXXXXXXXXX
    model_id        INT UNSIGNED NOT NULL,
    owner_cnp       VARCHAR(8) NOT NULL,
    plate           VARCHAR(8) NOT NULL,
    color_primary   INT UNSIGNED NOT NULL DEFAULT 0,
    color_secondary INT UNSIGNED NOT NULL DEFAULT 0,
    color_pearlescent INT UNSIGNED NOT NULL DEFAULT 0,
    mods            JSON DEFAULT NULL,
    fuel            FLOAT NOT NULL DEFAULT 100.0,
    mileage         FLOAT NOT NULL DEFAULT 0.0,
    `condition`     FLOAT NOT NULL DEFAULT 1000.0,

    -- Storage
    trunk_items     JSON DEFAULT NULL,
    front_trunk_items JSON DEFAULT NULL,

    -- Location
    garage_id       INT UNSIGNED DEFAULT NULL,
    is_impounded    TINYINT(1) NOT NULL DEFAULT 0,
    pos_x           FLOAT DEFAULT NULL,
    pos_y           FLOAT DEFAULT NULL,
    pos_z           FLOAT DEFAULT NULL,
    pos_h           FLOAT DEFAULT NULL,

    purchased_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (model_id) REFERENCES vehicle_models(id),
    FOREIGN KEY (owner_cnp) REFERENCES characters(cnp) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  GARAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS garages (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(64) NOT NULL,
    garage_type     VARCHAR(24) NOT NULL,  -- car, truck, boat, air
    -- Entry blip / marker
    pos_x           FLOAT NOT NULL,
    pos_y           FLOAT NOT NULL,
    pos_z           FLOAT NOT NULL,
    -- Vehicle spawn point
    spawn_x         FLOAT NOT NULL,
    spawn_y         FLOAT NOT NULL,
    spawn_z         FLOAT NOT NULL,
    spawn_h         FLOAT NOT NULL DEFAULT 0.0,
    blip_color      TINYINT UNSIGNED NOT NULL DEFAULT 3,
    blip_sprite     SMALLINT UNSIGNED NOT NULL DEFAULT 357,
    is_active       TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ============================================================
--  SHOWROOM
-- ============================================================
CREATE TABLE IF NOT EXISTS showroom_slots (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    model_id        INT UNSIGNED NOT NULL,
    garage_type     VARCHAR(24) NOT NULL,
    showcase_x      FLOAT NOT NULL DEFAULT 0.0,
    showcase_y      FLOAT NOT NULL DEFAULT 0.0,
    showcase_z      FLOAT NOT NULL DEFAULT 0.0,
    showcase_h      FLOAT NOT NULL DEFAULT 0.0,
    slot_order      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    is_available    TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (model_id) REFERENCES vehicle_models(id)
) ENGINE=InnoDB;

-- ============================================================
--  ITEM DEFINITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(64) NOT NULL UNIQUE,
    display_name    VARCHAR(64) NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    weight          FLOAT NOT NULL DEFAULT 0.1,
    max_stack       SMALLINT UNSIGNED NOT NULL DEFAULT 99,
    item_type       VARCHAR(24) NOT NULL DEFAULT 'misc',  -- weapon, drug, food, clothing, key, document, misc
    icon            VARCHAR(64) NOT NULL DEFAULT 'default',
    is_usable       TINYINT(1) NOT NULL DEFAULT 0,
    is_droppable    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ============================================================
--  CHARACTER INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS character_inventory (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_id    INT UNSIGNED NOT NULL,
    item_name       VARCHAR(64) NOT NULL,
    quantity        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    slot_index      SMALLINT NOT NULL DEFAULT 0,
    metadata        JSON DEFAULT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY uq_char_slot (character_id, slot_index)
) ENGINE=InnoDB;

-- ============================================================
--  HOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS houses (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    address         VARCHAR(100) NOT NULL,
    house_type      VARCHAR(24) NOT NULL DEFAULT 'apartment',  -- apartment, house, mansion
    interior_id     TINYINT UNSIGNED NOT NULL DEFAULT 0,
    price           INT UNSIGNED NOT NULL DEFAULT 50000,
    owner_cnp       VARCHAR(8) DEFAULT NULL,
    is_locked       TINYINT(1) NOT NULL DEFAULT 1,
    for_sale        TINYINT(1) NOT NULL DEFAULT 1,
    storage_items   JSON DEFAULT NULL,
    -- Exterior marker
    pos_x           FLOAT NOT NULL,
    pos_y           FLOAT NOT NULL,
    pos_z           FLOAT NOT NULL,
    -- Interior teleport
    interior_x      FLOAT NOT NULL DEFAULT 0.0,
    interior_y      FLOAT NOT NULL DEFAULT 0.0,
    interior_z      FLOAT NOT NULL DEFAULT 0.0,
    blip_color      TINYINT UNSIGNED NOT NULL DEFAULT 2
) ENGINE=InnoDB;

-- ============================================================
--  GANGS / MAFIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS gangs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(64) NOT NULL UNIQUE,
    tag             VARCHAR(6) NOT NULL UNIQUE,
    gang_type       VARCHAR(16) NOT NULL DEFAULT 'gang',  -- gang, mafia
    color_r         TINYINT UNSIGNED NOT NULL DEFAULT 255,
    color_g         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    color_b         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    bank_balance    INT UNSIGNED NOT NULL DEFAULT 0,
    territory       JSON DEFAULT NULL,
    rank_names      JSON DEFAULT NULL,
    safe_x          FLOAT DEFAULT NULL,
    safe_y          FLOAT DEFAULT NULL,
    safe_z          FLOAT DEFAULT NULL,
    max_members     TINYINT UNSIGNED NOT NULL DEFAULT 30,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gang_members (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gang_id         INT UNSIGNED NOT NULL,
    character_cnp   VARCHAR(8) NOT NULL UNIQUE,
    gang_rank       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    salary          INT UNSIGNED NOT NULL DEFAULT 0,
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gang_id) REFERENCES gangs(id) ON DELETE CASCADE,
    FOREIGN KEY (character_cnp) REFERENCES characters(cnp) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(32) NOT NULL UNIQUE,
    display_name    VARCHAR(64) NOT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    job_type        VARCHAR(16) NOT NULL DEFAULT 'legal',  -- legal, illegal
    pay_base        INT UNSIGNED NOT NULL DEFAULT 100,
    blip_sprite     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    blip_color      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    spawn_x         FLOAT NOT NULL DEFAULT 0.0,
    spawn_y         FLOAT NOT NULL DEFAULT 0.0,
    spawn_z         FLOAT NOT NULL DEFAULT 0.0,
    uniform         JSON DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
--  PHONE - CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_contacts (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_cnp       VARCHAR(8) NOT NULL,
    contact_cnp     VARCHAR(8) NOT NULL,
    contact_name    VARCHAR(32) NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_cnp) REFERENCES characters(cnp) ON DELETE CASCADE,
    UNIQUE KEY uq_contact (owner_cnp, contact_cnp)
) ENGINE=InnoDB;

-- ============================================================
--  PHONE - MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_messages (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_cnp      VARCHAR(8) NOT NULL,
    receiver_cnp    VARCHAR(8) NOT NULL,
    message         VARCHAR(512) NOT NULL,
    sent_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    INDEX idx_receiver (receiver_cnp),
    INDEX idx_sender (sender_cnp)
) ENGINE=InnoDB;

-- ============================================================
--  ROBBERY / CRIME LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS crime_logs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    crime_type      VARCHAR(32) NOT NULL,
    attacker_cnp    VARCHAR(8) NOT NULL,
    victim_cnp      VARCHAR(8) DEFAULT NULL,
    amount_stolen   INT UNSIGNED DEFAULT 0,
    success         TINYINT(1) NOT NULL DEFAULT 0,
    logged_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attacker (attacker_cnp)
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA - VEHICLE MODELS
-- ============================================================
INSERT IGNORE INTO vehicle_models (model_hash, display_name, category, price, has_rear_trunk, has_front_trunk, trunk_capacity) VALUES
('adder',       'Truffade Adder',       'car',        950000, 1, 0, 15),
('zentorno',    'Pegassi Zentorno',     'car',        725000, 1, 0, 15),
('t20',         'Progen T20',           'car',        2200000,1, 0, 15),
('insurgent',   'HVY Insurgent',        'car',        675000, 1, 0, 25),
('sultan',      'Karin Sultan',         'car',        12000,  1, 0, 20),
('sentinel',    'Übermacht Sentinel',   'car',        95000,  1, 0, 20),
('elegy2',      'Karin Elegy RH8',      'car',        95000,  1, 0, 20),
('schafter2',   'Übermacht Schafter V12','car',       116000, 1, 0, 20),
('akuma',       'Dinka Akuma',          'motorcycle', 9000,   0, 0, 10),
('bati',        'Pegassi Bati 801',     'motorcycle', 15000,  0, 0, 10),
('carbonrs',    'Pegassi Carbon RS',    'motorcycle', 18500,  0, 0, 10),
('bmx',         'BMX',                  'bicycle',    800,    0, 0, 5),
('tribike',     'Whippet Race Bike',    'bicycle',    3000,   0, 0, 5),
('hauler',      'MTL Hauler',           'truck',      350000, 1, 0, 60),
('phantomwedge','MTL Phantom Wedge',    'truck',      750000, 1, 0, 60),
('pounder',     'MTL Pounder',          'truck',      80000,  1, 0, 80),
('dinghy',      'Nagasaki Dinghy',      'boat',       25000,  0, 0, 10),
('speeder',     'Speedophile Seashark', 'boat',       75000,  0, 0, 10),
('besra',       'JoBuilt Besra',        'plane',      1750000,0, 0, 5),
('luxor',       'Buckingham Luxor',     'plane',      1500000,0, 0, 10),
('maverick',    'Buckingham Maverick',  'helicopter', 780000, 0, 0, 10),
('swift',       'Buckingham Swift',     'helicopter', 1620000,0, 0, 10);

-- ============================================================
--  SEED DATA - GARAGES
-- ============================================================
INSERT IGNORE INTO garages (name, garage_type, pos_x, pos_y, pos_z, spawn_x, spawn_y, spawn_z, spawn_h, blip_color, blip_sprite) VALUES
('Downtown Parking - Vinewood',  'car',   -323.45, -905.76, 31.08,  -318.2, -916.4,  30.9,  270.0, 3,  357),
('Port Parking - South LS',      'car',    -627.3, -2365.2, 13.0,   -632.1,-2370.6,  12.8,  180.0, 3,  357),
('Sandy Shores Parking',         'car',    1960.5,  3741.2,  32.3,  1965.2, 3736.8,  32.2,  90.0,  3,  357),
('Paleto Bay Parking',           'car',   -181.22, 6328.45, 31.57, -176.3,  6322.1,  31.4,  270.0, 3,  357),
('MTL Truck Depot - LS',         'truck',  -451.7, -1600.3,  15.5,  -445.2,-1608.7,  15.2,  90.0,  4,  477),
('Sandy Shores Truck Stop',      'truck',  2434.6,  4965.8,  45.6,  2430.1, 4972.3,  45.4,  180.0, 4,  477),
('LS Marina - East',             'boat',   -782.4, -1475.8,   0.4,  -786.2,-1482.3,   0.2,  270.0, 56, 427),
('Alamo Sea Marina',             'boat',   1271.3,  3711.5,  38.9,  1266.7, 3705.2,  38.8,  90.0,  56, 427),
('LSIA Hangar - Private',        'air',    -1069.3, -2658.6,  13.8, -1075.4,-2664.7,  13.6,  90.0,  2,  423),
('Sandy Shores Airfield',        'air',    1741.6,  3272.3,  41.1,  1746.8, 3268.4,  41.0,  270.0, 2,  423);

-- ============================================================
--  SEED DATA - JOBS
-- ============================================================
INSERT IGNORE INTO jobs (name, display_name, description, job_type, pay_base, blip_sprite, blip_color, spawn_x, spawn_y, spawn_z) VALUES
('taxi',        'Taxi Driver',      'Transport citizens around Blackridge City.', 'legal',   120,  198, 5,  -69.08,  -1762.33, 28.4),
('trucker',     'Truck Driver',     'Deliver goods across the state.',             'legal',   200,  477, 4,  -451.7, -1600.3,  15.5),
('mechanic',    'Mechanic',         'Repair and tune vehicles at the auto shop.',  'legal',   150,  452, 3,  -350.16, -130.47, 38.0),
('fisherman',   'Fisherman',        'Catch fish and sell at the market.',          'legal',   80,   68,  56, -682.7, -1843.9,   5.5),
('miner',       'Miner',            'Extract ore in the Sandy Shores mines.',      'legal',   180,  242, 4,  2950.1,  2813.6,  41.2),
('dealer',      'Street Dealer',    'Sell contraband to buyers on the street.',    'illegal', 400,  140, 1,  180.12, -1680.2,  28.4),
('hacker',      'Network Hacker',   'Steal data from corporate servers.',          'illegal', 600,  464, 6, -1062.4, -270.6,  37.0),
('carjacker',   'Car Thief',        'Steal and deliver vehicles for crime bosses.','illegal', 350,  59,  1,  323.4,  -1975.8,  24.3);

-- ============================================================
--  SEED DATA - ITEMS
-- ============================================================
INSERT IGNORE INTO items (name, display_name, description, weight, max_stack, item_type, icon, is_usable) VALUES
('bandage',         'Bandage',              'Restores 10 HP.',                  0.1, 10, 'food',     'bandage',     1),
('medkit',          'Medical Kit',          'Restores 100 HP.',                 0.5, 5,  'food',     'medkit',      1),
('water',           'Water Bottle',         'Restores thirst.',                 0.2, 5,  'food',     'water',       1),
('sandwich',        'Sandwich',             'Restores hunger.',                 0.2, 5,  'food',     'sandwich',    1),
('lockpick',        'Lockpick',             'Can unlock basic locks.',          0.1, 5,  'misc',     'lockpick',    1),
('phone',           'Smartphone',           'Your personal phone.',             0.3, 1,  'misc',     'phone',       1),
('wallet',          'Wallet',               'Holds cash and cards.',            0.1, 1,  'document', 'wallet',      0),
('id_card',         'ID Card',              'Your CNP identification card.',    0.05,1,  'document', 'idcard',      1),
('house_key',       'House Key',            'Key to your property.',            0.05,5,  'key',      'key_house',   0),
('vehicle_key',     'Vehicle Key',          'Key to a vehicle.',                0.05,5,  'key',      'key_vehicle', 0),
('weed',            'Marijuana',            'Illegal substance.',               0.1, 50, 'drug',     'weed',        1),
('cocaine',         'Cocaine',              'Illegal substance.',               0.05,20, 'drug',     'cocaine',     1),
('pistol',          'Pistol',               'Standard sidearm.',                0.8, 1,  'weapon',   'pistol',      0),
('knife',           'Combat Knife',         'Close quarters weapon.',           0.3, 1,  'weapon',   'knife',       0),
('crowbar',         'Crowbar',              'Useful tool. Also a weapon.',      1.0, 1,  'weapon',   'crowbar',     0),
('ammo_pistol',     'Pistol Ammo',          '9mm rounds.',                      0.05,200,'misc',     'ammo',        0),
('rope',            'Rope',                 'For tying things... or people.',   0.5, 3,  'misc',     'rope',        0),
('balaclava',       'Balaclava',            'Conceals your identity.',          0.1, 1,  'clothing', 'balaclava',   1),
('drugs_bag',       'Drug Bag',             'Contains mixed narcotics.',        0.3, 10, 'drug',     'drugbag',     0),
('money_bag',       'Money Bag',            'Filled with cash.',                0.5, 1,  'misc',     'moneybag',    0);

-- ============================================================
--  SEED DATA - GANGS / MAFIAS
-- ============================================================
INSERT IGNORE INTO gangs (name, tag, gang_type, color_r, color_g, color_b, rank_names, safe_x, safe_y, safe_z) VALUES
('Vagos',       'VGS', 'gang',  255, 200, 0,
 '["Prospect","Member","Soldier","Underboss","Boss","El Jefe"]',
 270.5, -2157.8, 12.3),
('Ballas',      'BLS', 'gang',  128, 0,   255,
 '["Prospect","Member","Soldier","OG","Shot Caller","Boss"]',
 -118.8, -1638.2, 28.4),
('Los Zetas',   'LZ',  'mafia', 0,   0,   0,
 '["Associate","Soldier","Caporegime","Underboss","Consigliere","Don"]',
 -1453.2, -305.8, 46.3),
('Syndicate',   'SYN', 'mafia', 255, 45,  120,
 '["Ghost","Agent","Operator","Handler","Director","Shadow"]',
 -1063.4, -264.7, 37.0);
