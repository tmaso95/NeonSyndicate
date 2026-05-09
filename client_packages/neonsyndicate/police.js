let policeBrowser  = null;
let onDuty         = false;
let dutyType       = null;

// ── DUTY STATE ────────────────────────────────────────────────
mp.events.add('police:dutyChanged', (active, type) => {
    onDuty   = active;
    dutyType = type;
    if (policeBrowser) {
        policeBrowser.execute(`setDutyState(${active}, '${type || ''}')`);
    }
});

// ── UNIFORMS ──────────────────────────────────────────────────
mp.events.add('police:applyUniform', (uniformType) => {
    const local = mp.players.local;
    const sex   = local.model === mp.game.joaat('mp_f_freemode_01') ? 1 : 0;

    const uniforms = {
        police: {
            male:   [{ c:1,d:55,t:0 },{ c:3,d:0,t:0 },{ c:4,d:35,t:0 },{ c:6,d:25,t:0 },{ c:8,d:58,t:0 },{ c:11,d:55,t:0 }],
            female: [{ c:1,d:48,t:0 },{ c:3,d:0,t:0 },{ c:4,d:34,t:0 },{ c:6,d:25,t:0 },{ c:8,d:57,t:0 },{ c:11,d:48,t:0 }]
        },
        swat: {
            male:   [{ c:1,d:9,t:0  },{ c:3,d:0,t:0 },{ c:4,d:46,t:0 },{ c:6,d:25,t:0 },{ c:8,d:58,t:0 },{ c:11,d:46,t:0 }],
            female: [{ c:1,d:9,t:0  },{ c:3,d:0,t:0 },{ c:4,d:46,t:0 },{ c:6,d:25,t:0 },{ c:8,d:57,t:0 },{ c:11,d:46,t:0 }]
        },
        ems: {
            male:   [{ c:1,d:57,t:0 },{ c:3,d:0,t:0 },{ c:4,d:37,t:0 },{ c:6,d:25,t:0 },{ c:8,d:58,t:0 },{ c:11,d:57,t:0 }],
            female: [{ c:1,d:50,t:0 },{ c:3,d:0,t:0 },{ c:4,d:36,t:0 },{ c:6,d:25,t:0 },{ c:8,d:57,t:0 },{ c:11,d:50,t:0 }]
        }
    };

    const set = uniforms[uniformType];
    if (!set) return;
    const parts = sex === 1 ? set.female : set.male;
    parts.forEach(p => {
        mp.game.invoke('0x262B14F48D29DE80', local.handle, p.c, p.d, p.t, 2); // SET_PED_COMPONENT_VARIATION
    });
});

// ── MDT ───────────────────────────────────────────────────────
mp.events.add('police:showMDT', () => {
    if (!policeBrowser) {
        policeBrowser = mp.browsers.new('package://ui/police/index.html');
        showCursor(true);
    }
    policeBrowser.execute('openMDT()');
});

mp.events.add('police:mdtResult', (dataJSON) => {
    if (policeBrowser) policeBrowser.execute(`mdtResult(${dataJSON})`);
});

// ── ARREST / JAIL ─────────────────────────────────────────────
mp.events.add('police:arrested', (jailMin) => {
    mp.game.ui.displayHelpTextThisFrame(`Ai fost arestat! Timp: ${jailMin} minute.`);
});

mp.events.add('police:released', () => {
    mp.game.ui.displayHelpTextThisFrame('Ai fost eliberat!');
});

mp.events.add('police:jailTimerTick', (remaining) => {
    mp.game.ui.displayHelpTextThisFrame(`Timp ramas in inchisoare: ${remaining} minute`);
});

// ── EMS ───────────────────────────────────────────────────────
mp.events.add('ems:revived', () => {
    mp.game.ui.displayHelpTextThisFrame('Ai fost resuscitat de EMS!');
});

mp.events.add('ems:injuryTreated', (bodyPart) => {
    mp.game.ui.displayHelpTextThisFrame(`Rana ${bodyPart} tratata.`);
});

mp.events.add('ems:respawned', () => {
    mp.game.ui.displayHelpTextThisFrame('Ai fost transportat la spital.');
});

mp.events.add('hud:updateWanted', (level) => {
    if (typeof updateWanted === 'function') updateWanted(level);
});

// ── KEY: F5 = open MDT ────────────────────────────────────────
mp.keys.bind(0x74, true, () => {
    if (policeBrowser) {
        policeBrowser.destroy();
        policeBrowser = null;
        showCursor(false);
    } else if (onDuty) {
        mp.events.callRemote('police:openMDT');
    }
});

// Browser → server
mp.events.add('police:browserSearchPerson',  (cnp)             => mp.events.callRemote('police:searchPerson',  cnp));
mp.events.add('police:browserSearchVehicle', (vinOrPlate)      => mp.events.callRemote('police:searchVehicle', vinOrPlate));
mp.events.add('police:browserArrest',        (id, reason, min) => mp.events.callRemote('police:arrest',        id, reason, min));
mp.events.add('police:browserFine',          (id, amt, reason) => mp.events.callRemote('police:fine',          id, amt, reason));
mp.events.add('police:browserWarrant',       (cnp, reason, t)  => mp.events.callRemote('police:issueWarrant',  cnp, reason, t));
mp.events.add('police:browserOnDuty',        (unit)            => mp.events.callRemote('police:onDuty',        unit));
mp.events.add('police:browserOffDuty',       ()                => mp.events.callRemote('police:offDuty'));
mp.events.add('police:browserRevive',        (id)              => mp.events.callRemote('ems:revive',           id));
mp.events.add('police:browserTreat',         (id, part)        => mp.events.callRemote('ems:treatInjury',      id, part));
mp.events.add('police:browserImpound',       (vin)             => mp.events.callRemote('police:impound',       vin));
mp.events.add('police:browserClose', () => {
    if (policeBrowser) { policeBrowser.destroy(); policeBrowser = null; }
    showCursor(false);
});
