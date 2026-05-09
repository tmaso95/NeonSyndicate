const db = require('../../database/connection');
const { giveXP, giveCash } = require('../character/index');

// ── JOIN JOB ──────────────────────────────────────────────────
mp.events.add('job:join', async (player, jobName) => {
    if (!player.data || !player.data.cnp) return;

    const job = await db.queryOne('SELECT * FROM jobs WHERE name = ?', [jobName]);
    if (!job) return player.call('hud:notification', ['Job inexistent.', 'error']);

    await db.update('UPDATE characters SET job_name = ? WHERE cnp = ?', [job.name, player.data.cnp]);
    if (player.data.character) player.data.character.job_name = job.name;

    // Apply job uniform if exists
    if (job.uniform) {
        const uniform = typeof job.uniform === 'string' ? JSON.parse(job.uniform) : job.uniform;
        player.call('character:applyClothes', [JSON.stringify(uniform)]);
    }

    player.call('hud:notification', [`Ai ales jobul: ${job.display_name}`, 'success']);
    player.call('job:receiveInfo', [JSON.stringify(job)]);
});

// ── QUIT JOB ──────────────────────────────────────────────────
mp.events.add('job:quit', async (player) => {
    if (!player.data || !player.data.cnp) return;
    await db.update('UPDATE characters SET job_name = NULL WHERE cnp = ?', [player.data.cnp]);
    player.call('hud:notification', ['Ai renuntat la job.', 'info']);
});

// ── COMPLETE TASK ─────────────────────────────────────────────
mp.events.add('job:taskComplete', async (player, taskData) => {
    if (!player.data || !player.data.cnp) return;

    const char = await db.queryOne('SELECT job_name FROM characters WHERE cnp = ?', [player.data.cnp]);
    if (!char || !char.job_name) return;

    const job   = await db.queryOne('SELECT pay_base FROM jobs WHERE name = ?', [char.job_name]);
    if (!job) return;

    const bonus = taskData && taskData.bonus ? parseInt(taskData.bonus) : 0;
    const pay   = job.pay_base + bonus;

    await giveCash(player.data.cnp, pay);
    await db.update('UPDATE characters SET cash = cash + ? WHERE cnp = ?', [pay, player.data.cnp]);
    await giveXP(player, Math.floor(pay / 10));

    player.call('hud:notification', [`Task completat! +$${pay}`, 'success']);
});

// ── GET JOB LIST ──────────────────────────────────────────────
mp.events.add('job:getList', async (player) => {
    const jobs = await db.queryAll('SELECT name, display_name, description, job_type, pay_base FROM jobs');
    player.call('job:receiveList', [JSON.stringify(jobs)]);
});
