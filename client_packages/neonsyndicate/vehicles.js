const HANDLING_FIELDS = {
    mass:             0x00000001,
    initialDragCoeff: 0x00000002,
    maxVelocity:      0x00000004,
    acceleration:     0x00000040,
    brakeForce:       0x00000200,
    tractionCurveMax: 0x00000800
};

// ── APPLY CUSTOM HANDLING ─────────────────────────────────────
mp.events.add('vehicle:applyHandling', (vin, dataJSON) => {
    const data = JSON.parse(dataJSON);
    const local = mp.players.local;
    if (!local.vehicle) return;
    if (local.vehicle.getVariable('vin') !== vin) return;

    const handle = local.vehicle.handle;

    if (data.mass !== null)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fMass', data.mass);
    if (data.initialDragCoeff !== null)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fInitialDragCoeff', data.initialDragCoeff);
    if (data.maxVelocity !== null)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fMaxFlatVelocity', data.maxVelocity);
    if (data.acceleration !== null)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fAcceleration', data.acceleration);
    if (data.brakeForce !== null)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fBrakeForce', data.brakeForce);
    if (data.tractionCurveMax !== null)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fTractionCurveMax', data.tractionCurveMax);
});

// ── ENGINE ON/OFF ─────────────────────────────────────────────
mp.keys.bind(0x55, true, () => {  // U key
    const local = mp.players.local;
    if (!local.vehicle) return;
    const engineOn = local.vehicle.getVariable('engineOn') || false;
    local.vehicle.setVariable('engineOn', !engineOn);
    mp.game.invoke('0x2497C4717C8B881E', local.vehicle.handle, !engineOn, true, false);
    mp.events.callRemote('hud:notification', engineOn ? 'Motor oprit.' : 'Motor pornit.', 'info');
});

// ── VEHICLE ENTER: request handling ──────────────────────────
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    if (seat !== -1) return;
    const vin = vehicle.getVariable('vin');
    if (vin) mp.events.callRemote('vehicle:requestHandling', vin);
});

// ── LOCK TOGGLE (L key) ───────────────────────────────────────
mp.keys.bind(0x4C, true, () => {
    const local = mp.players.local;
    if (!local.vehicle) return;
    const vin = local.vehicle.getVariable('vin');
    if (vin) mp.events.callRemote('vehicle:toggleLock', vin);
});
