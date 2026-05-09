// ── NEON SYNDICATE | VEHICLES ─────────────────────────────────

// ── APPLY CUSTOM HANDLING ─────────────────────────────────────
// Invoke hash: SET_VEHICLE_HANDLING_FIELD (0x90DD01C19E61D4F3)
mp.events.add('vehicle:applyHandling', (vin, dataJSON) => {
    const data  = JSON.parse(dataJSON);
    const local = mp.players.local;
    if (!local.vehicle) return;
    if (local.vehicle.getVariable('vin') !== vin) return;

    const handle = local.vehicle.handle;

    if (data.mass !== null && data.mass !== undefined)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fMass', data.mass);
    if (data.initialDragCoeff !== null && data.initialDragCoeff !== undefined)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fInitialDragCoeff', data.initialDragCoeff);
    if (data.maxVelocity !== null && data.maxVelocity !== undefined)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fMaxFlatVelocity', data.maxVelocity);
    if (data.acceleration !== null && data.acceleration !== undefined)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fAcceleration', data.acceleration);
    if (data.brakeForce !== null && data.brakeForce !== undefined)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fBrakeForce', data.brakeForce);
    if (data.tractionCurveMax !== null && data.tractionCurveMax !== undefined)
        mp.game.invoke('0x90DD01C19E61D4F3', handle, 'fTractionCurveMax', data.tractionCurveMax);
});

// ── ENGINE ON/OFF — U key ─────────────────────────────────────
mp.keys.bind(0x55, true, () => {
    const local = mp.players.local;
    if (!local.vehicle) return;

    const engineOn = local.vehicle.getVariable('engineOn') || false;
    local.vehicle.setVariable('engineOn', !engineOn);

    // Native: SET_VEHICLE_ENGINE_ON (0x2497C4717C8B881E)
    mp.game.invoke('0x2497C4717C8B881E', local.vehicle.handle, !engineOn, true, false);
    mp.events.callRemote('vehicle:toggleEngine');

    mp.events.call('hud:notification', engineOn ? 'Motor oprit.' : 'Motor pornit.', 'info');
});

// ── LOCK TOGGLE — L key ───────────────────────────────────────
mp.keys.bind(0x4C, true, () => {
    const local = mp.players.local;
    if (!local.vehicle) return;
    const vin = local.vehicle.getVariable('vin');
    if (vin) mp.events.callRemote('vehicle:toggleLock', vin);
});

// ── ENTER VEHICLE: request custom handling from server ────────
mp.events.add('playerEnterVehicle', (vehicle, seat) => {
    // seat === -1 means driver seat
    if (seat !== -1) return;
    const vin = vehicle.getVariable('vin');
    if (vin) mp.events.callRemote('vehicle:requestHandling', vin);
});
