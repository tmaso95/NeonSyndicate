-- ============================================================
--  NEON SYNDICATE — SCHEMA PATCH v2
--  Ruleaza DUPA schema.sql initial
-- ============================================================
USE neonsyndicate;

-- ============================================================
--  ADMIN SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id      INT UNSIGNED NOT NULL UNIQUE,
    admin_rank      ENUM('tester','helper','moderator','admin','head_admin','co_owner','owner') NOT NULL DEFAULT 'helper',
    granted_by      INT UNSIGNED DEFAULT NULL,
    notes           VARCHAR(255) DEFAULT NULL,
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  CHARACTER STATS (survival + physical + injuries)
-- ============================================================
ALTER TABLE characters
    ADD COLUMN IF NOT EXISTS hunger          INT NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS thirst          INT NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS stamina         INT NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS stress          INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS carry_base      FLOAT NOT NULL DEFAULT 4.0,
    ADD COLUMN IF NOT EXISTS carry_gym       FLOAT NOT NULL DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS phone_number    VARCHAR(10) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS has_driving_license   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_weapon_license    TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_fishing_license   TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS criminal_record       JSON DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS fingerprint           VARCHAR(64) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS beard_style    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS beard_color    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tattoos        JSON DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_in_coma     TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coma_start     DATETIME DEFAULT NULL;

-- Fix starting money to match document
-- (New characters only — update default)
ALTER TABLE characters
    MODIFY COLUMN cash INT UNSIGNED NOT NULL DEFAULT 1000,
    MODIFY COLUMN bank INT UNSIGNED NOT NULL DEFAULT 3000;

-- ============================================================
--  INJURIES
-- ============================================================
CREATE TABLE IF NOT EXISTS character_injuries (
    character_id        INT UNSIGNED NOT NULL PRIMARY KEY,
    injury_head         TINYINT(1) NOT NULL DEFAULT 0,
    injury_chest        TINYINT(1) NOT NULL DEFAULT 0,
    injury_left_arm     TINYINT(1) NOT NULL DEFAULT 0,
    injury_right_arm    TINYINT(1) NOT NULL DEFAULT 0,
    injury_left_leg     TINYINT(1) NOT NULL DEFAULT 0,
    injury_right_leg    TINYINT(1) NOT NULL DEFAULT 0,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  WORLD DROPS (items dropped on ground)
-- ============================================================
CREATE TABLE IF NOT EXISTS world_drops (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_name       VARCHAR(64) NOT NULL,
    quantity        FLOAT NOT NULL DEFAULT 1,
    metadata        JSON DEFAULT NULL,
    x               FLOAT NOT NULL,
    y               FLOAT NOT NULL,
    z               FLOAT NOT NULL,
    dropped_by      VARCHAR(8) DEFAULT NULL,
    dropped_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    disappear_at    DATETIME NOT NULL,
    INDEX idx_disappear (disappear_at)
) ENGINE=InnoDB;

-- ============================================================
--  BAG ITEMS (items that add carry capacity)
-- ============================================================
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS bag_capacity FLOAT NOT NULL DEFAULT 0.0;

-- Update existing bag items
UPDATE items SET bag_capacity = 3.0 WHERE name = 'backpack' OR name LIKE '%bag%';

INSERT IGNORE INTO items (name, display_name, description, weight, max_stack, item_type, icon, is_usable, is_droppable, bag_capacity) VALUES
('backpack_small',  'Rucsac Mic',       'Adauga 3kg capacitate.',   0.3, 1, 'clothing', 'bag_small',  1, 1, 3.0),
('backpack_large',  'Rucsac Mare',      'Adauga 6kg capacitate.',   0.5, 1, 'clothing', 'bag_large',  1, 1, 6.0),
('fanny_pack',      'Borseta',          'Adauga 1.5kg capacitate.', 0.1, 1, 'clothing', 'bag_fanny',  1, 1, 1.5),
('suitcase',        'Valiza',           'Adauga 8kg capacitate.',   1.0, 1, 'clothing', 'bag_suitcase',1,1, 8.0),
('protein_bar',     'Baton Proteic',    'Mareste efectul salii.',   0.1, 10,'food',      'protein_bar',1, 1, 0.0),
('water_bottle_l',  'Apa 500ml',        'Sete +30.',                0.2, 5, 'food',      'water_l',    1, 1, 0.0),
('energy_drink',    'Bautura Energizanta','Stamina +20, Stress -5.', 0.15,5,'food',      'energy',     1, 1, 0.0),
('phone_basic',     'Telefon Basic',    'Model de baza.',           0.3, 1, 'misc',      'phone_basic',0, 0, 0.0),
('phone_mid',       'Telefon Mediu',    'Model mid-range.',         0.3, 1, 'misc',      'phone_mid',  0, 0, 0.0),
('phone_high',      'Telefon Premium',  'Model flagship.',          0.3, 1, 'misc',      'phone_high', 0, 0, 0.0),
('sim_card',        'Cartela SIM',      'Necesara pentru telefon.', 0.01,1, 'misc',      'sim',        1, 1, 0.0);

-- ============================================================
--  BUSINESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(64) NOT NULL,
    business_type   VARCHAR(32) NOT NULL,  -- clothing_m,clothing_f,shoes,mixed,restaurant,cafe,electronics,pharmacy,barbershop,salon,hairdresser,mechanic,tuning,showroom,casino,newspaper
    gender_restrict ENUM('none','male','female') NOT NULL DEFAULT 'none',
    owner_cnp       VARCHAR(8) DEFAULT NULL,   -- NULL = de stat
    is_state_owned  TINYINT(1) NOT NULL DEFAULT 0,
    daily_tax       DECIMAL(10,2) NOT NULL DEFAULT 300.00,
    pos_x           FLOAT NOT NULL,
    pos_y           FLOAT NOT NULL,
    pos_z           FLOAT NOT NULL,
    blip_sprite     SMALLINT UNSIGNED NOT NULL DEFAULT 52,
    blip_color      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    is_open         TINYINT(1) NOT NULL DEFAULT 1,
    bank_balance    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    for_sale        TINYINT(1) NOT NULL DEFAULT 0,
    sale_price      DECIMAL(15,2) NOT NULL DEFAULT 100000.00,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  BUSINESS STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS business_stock (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id     INT UNSIGNED NOT NULL,
    item_name       VARCHAR(64) NOT NULL,
    quantity        INT UNSIGNED NOT NULL DEFAULT 0,
    max_quantity    INT UNSIGNED NOT NULL DEFAULT 100,
    sell_price      DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    buy_price       DECIMAL(10,2) NOT NULL DEFAULT 5.00,   -- patron reaprovizionare
    last_restock    DATETIME DEFAULT NULL,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_biz_item (business_id, item_name)
) ENGINE=InnoDB;

-- ============================================================
--  BUSINESS EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS business_employees (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id     INT UNSIGNED NOT NULL,
    character_cnp   VARCHAR(8) NOT NULL,
    role            VARCHAR(32) NOT NULL DEFAULT 'angajat',  -- angajat, manager
    salary          DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    hired_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (character_cnp) REFERENCES characters(cnp) ON DELETE CASCADE,
    UNIQUE KEY uq_emp (business_id, character_cnp)
) ENGINE=InnoDB;

-- ============================================================
--  POLICE
-- ============================================================
CREATE TABLE IF NOT EXISTS police_reports (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_type     ENUM('arrest','ticket','search','incident','pursuit','wanted') NOT NULL,
    officer_cnp     VARCHAR(8) NOT NULL,
    suspect_cnp     VARCHAR(8) DEFAULT NULL,
    description     TEXT NOT NULL,
    evidence        JSON DEFAULT NULL,
    fine_amount     DECIMAL(10,2) DEFAULT 0,
    jail_time       INT UNSIGNED DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS police_warrants (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    suspect_cnp     VARCHAR(8) NOT NULL,
    issued_by       VARCHAR(8) NOT NULL,
    reason          TEXT NOT NULL,
    warrant_type    ENUM('arrest','search','vehicle') NOT NULL DEFAULT 'arrest',
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME DEFAULT NULL,
    FOREIGN KEY (suspect_cnp) REFERENCES characters(cnp) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  GYM SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS gym_sessions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    character_cnp   VARCHAR(8) NOT NULL,
    exercise_type   VARCHAR(32) NOT NULL,  -- bench_press, squat, run, box, swim
    duration_min    INT UNSIGNED NOT NULL DEFAULT 0,
    kg_gained       FLOAT NOT NULL DEFAULT 0.0,
    used_protein    TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_cnp) REFERENCES characters(cnp) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA — BUSINESSES
-- ============================================================
INSERT IGNORE INTO businesses (name, business_type, gender_restrict, is_state_owned, daily_tax, pos_x, pos_y, pos_z, blip_sprite, blip_color, for_sale, sale_price) VALUES
('Blackridge Electronics',    'electronics',  'none',   1, 280.00, -715.8, -911.4, 19.2,  67, 6, 0,      0),
('Farmacia Central',          'pharmacy',     'none',   1, 0.00,   -1476.1,-378.6, 40.2,  58, 2, 0,      0),
('Men Style Club',            'clothing_m',   'male',   0, 250.00, 118.8,  -224.5, 54.6,  73, 4, 1, 150000),
('Femme Boutique',            'clothing_f',   'female', 0, 250.00, -829.3, -1074.5,11.3,  73, 52,1, 150000),
('Step Up Shoes',             'shoes',        'none',   0, 200.00, -720.4, -155.1, 37.5,  73, 65,1, 120000),
('Blackridge Mixt Store',     'mixed',        'none',   0, 300.00, 25.2,   -1345.8,29.5,  52, 3, 1, 200000),
('The Neon Diner',            'restaurant',   'none',   0, 350.00, -1220.3,-332.2, 37.5,  93, 69,1, 250000),
('CyberCafe NS',              'cafe',         'none',   0, 200.00, -694.5, -260.6, 37.0,  93, 4, 1, 120000),
('Barberul din Oras',         'barbershop',   'male',   0, 200.00, -32.0,  -153.1, 57.1,  71, 0, 1, 100000),
('Salon Neon',                'salon',        'female', 0, 150.00, -818.7, -183.3, 37.7,  71, 8, 1,  80000),
('The Neon Palace Casino',    'casino',       'none',   0, 1000.00,-1432.8,-632.4, 30.0,  79, 7, 1, 5000000),
('Blackridge Tribune',        'newspaper',    'none',   0, 200.00, -698.4, -568.5, 30.0,  115,0, 1, 300000);

-- ============================================================
--  SEED DATA — BUSINESS STOCK
-- ============================================================
-- Electronics store stock
INSERT IGNORE INTO business_stock (business_id, item_name, quantity, max_quantity, sell_price) VALUES
(1, 'phone_basic', 50, 100, 1500.00),
(1, 'phone_mid',   30, 50,  4500.00),
(1, 'phone_high',  10, 20,  9000.00),
(1, 'sim_card',    100,200, 50.00);

-- Pharmacy stock
INSERT IGNORE INTO business_stock (business_id, item_name, quantity, max_quantity, sell_price) VALUES
(2, 'bandage',      100, 200, 25.00),
(2, 'medkit',       30,  50,  200.00),
(2, 'water_bottle_l',100,200, 10.00),
(2, 'protein_bar',  80, 150, 50.00);

-- Mixed store stock
INSERT IGNORE INTO business_stock (business_id, item_name, quantity, max_quantity, sell_price) VALUES
(6, 'water_bottle_l',100,200, 15.00),
(6, 'sandwich',      80, 150, 20.00),
(6, 'energy_drink',  60, 100, 25.00),
(6, 'backpack_small',20, 40,  300.00),
(6, 'backpack_large',10, 20,  600.00),
(6, 'fanny_pack',    25, 50,  150.00);
