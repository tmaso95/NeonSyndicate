'use strict';

require('dotenv').config();
const express        = require('express');
const session        = require('express-session');
const mysql          = require('mysql2/promise');
const path           = require('path');

// ============================================================
//  CONFIG
// ============================================================

const PORT         = parseInt(process.env.PANEL_PORT  || '8080', 10);
const PANEL_SECRET = process.env.PANEL_SECRET         || 'ns_admin_2026';
const SESSION_KEY  = process.env.SESSION_SECRET       || 'ns_session_key_x92f';

const DB_CONFIG = {
  host:               process.env.DB_HOST || '127.0.0.1',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER || 'root',
  password:           process.env.DB_PASS || '',
  database:           process.env.DB_NAME || 'neonsyndicate',
  charset:            'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
};

// ============================================================
//  DATABASE POOL
// ============================================================

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

async function query(sql, params = []) {
  const db = await getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ============================================================
//  EXPRESS APP
// ============================================================

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret:            SESSION_KEY,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,          // set true if behind HTTPS
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000,  // 8 hours
  },
}));

// ============================================================
//  AUTH MIDDLEWARE
// ============================================================

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.redirect('/login');
}

// ============================================================
//  TEMPLATE HELPERS
// ============================================================

const ADMIN_RANK_ORDER = ['tester','helper','moderator','admin','head_admin','co_owner','owner'];

function rankBadge(rank) {
  if (!rank) return '<span class="text-muted">—</span>';
  const label = rank.replace(/_/g,' ').toUpperCase();
  return `<span class="rank-${rank}" style="font-weight:600;letter-spacing:.06em;">${label}</span>`;
}

function yesNo(val, yes = 'Yes', no = 'No') {
  if (val) return `<span class="badge badge-green">${yes}</span>`;
  return `<span class="badge badge-gray">${no}</span>`;
}

function fmtDate(d) {
  if (!d) return '<span class="text-muted">—</span>';
  const dt = new Date(d);
  return dt.toISOString().replace('T', ' ').slice(0, 16);
}

function fmtMins(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US');
}

function progressBar(val, max, cls = 'cyan') {
  const pct = Math.min(100, Math.round((val / max) * 100));
  return `<div class="progress" title="${val}/${max}"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>`;
}

function renderPage(title, content, req, { activeNav = '' } = {}) {
  const nav = [
    { href: '/dashboard', label: 'Dashboard',  icon: '⬡', key: 'dashboard' },
    { href: '/players',   label: 'Players',     icon: '◈', key: 'players'   },
    { href: '/admins',    label: 'Admins',       icon: '◆', key: 'admins'    },
    { href: '/vehicles',  label: 'Vehicles',     icon: '◉', key: 'vehicles'  },
    { href: '/logs',      label: 'Crime Logs',   icon: '◐', key: 'logs'      },
  ];

  const navHtml = nav.map(n =>
    `<a href="${n.href}" class="nav-link ${activeNav === n.key ? 'active' : ''}">
      <span class="nav-icon">${n.icon}</span><span>${n.label}</span>
    </a>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escHtml(title)} | Neon Syndicate Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"/>
  <link rel="stylesheet" href="/style.css"/>
</head>
<body>

<nav class="sidebar">
  <div class="sidebar-brand">
    <div class="logo-text">
      <span class="pink">NEON</span><span class="cyan">SYN</span>
    </div>
    <div class="sub-label">Admin Panel</div>
  </div>

  <div class="sidebar-nav">
    <div class="nav-section-label">Navigation</div>
    ${navHtml}
    <div class="nav-section-label" style="margin-top:20px;">Account</div>
    <a href="/logout" class="nav-link danger">
      <span class="nav-icon">✕</span><span>Logout</span>
    </a>
  </div>

  <div class="sidebar-footer">v1.0 · 2026</div>
</nav>

<div class="main-wrapper">
  <div class="main-content">
    ${content}
  </div>
  <footer class="main-footer">
    Neon Syndicate Admin Panel | 2026
  </footer>
</div>

<script>
/* Client-side table search */
function tableSearch(inputId, tableId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    const term = input.value.toLowerCase();
    const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
}
document.addEventListener('DOMContentLoaded', () => {
  tableSearch('searchInput', 'mainTable');
  tableSearch('searchVehicles', 'vehicleTable');
  tableSearch('searchAdmins', 'adminsTable');
  tableSearch('searchLogs', 'logsTable');
});

/* Confirm before form submit */
function confirmAction(msg) {
  return confirm(msg || 'Are you sure?');
}
</script>
</body>
</html>`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
//  ROUTES — PUBLIC
// ============================================================

app.get('/', (req, res) => {
  res.redirect(req.session && req.session.authed ? '/dashboard' : '/login');
});

// ---- Login ----

app.get('/login', (req, res) => {
  if (req.session && req.session.authed) return res.redirect('/dashboard');
  const err = req.query.err;
  const html = `
  <div class="login-wrap">
    <div class="login-box">
      <div class="login-logo">
        <div class="brand"><span class="pink">NEON</span> <span class="cyan">SYNDICATE</span></div>
        <div class="sub">Admin Panel · Blackridge City</div>
      </div>
      <hr class="login-divider"/>
      ${err ? `<div class="alert alert-error">Invalid secret key. Access denied.</div>` : ''}
      <form method="POST" action="/login" autocomplete="off">
        <div class="form-group">
          <label class="form-label" for="secret">Admin Secret Key</label>
          <input id="secret" class="input" type="password" name="secret" placeholder="Enter secret key…" required autofocus/>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="margin-top:8px;">
          ACCESS PANEL
        </button>
      </form>
    </div>
  </div>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Login | Neon Syndicate Admin</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"/>
  <link rel="stylesheet" href="/style.css"/>
</head>
<body style="display:block;">
${html}
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const { secret } = req.body;
  if (secret === PANEL_SECRET) {
    req.session.authed = true;
    return res.redirect('/dashboard');
  }
  res.redirect('/login?err=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ============================================================
//  ROUTES — PROTECTED
// ============================================================

// ---- Dashboard ----

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const [accounts, chars, vehicles, banned, admins] = await Promise.all([
      queryOne('SELECT COUNT(*) AS n FROM accounts'),
      queryOne('SELECT COUNT(*) AS n FROM characters'),
      queryOne('SELECT COUNT(*) AS n FROM vehicles'),
      queryOne('SELECT COUNT(*) AS n FROM accounts WHERE is_banned = 1'),
      queryOne('SELECT COUNT(*) AS n FROM admins WHERE is_active = 1'),
    ]);

    const totalAccounts = accounts?.n ?? 0;
    const totalChars    = chars?.n    ?? 0;
    const totalVehicles = vehicles?.n ?? 0;
    const totalBanned   = banned?.n   ?? 0;
    const totalAdmins   = admins?.n   ?? 0;

    // Last 5 registered accounts
    const recentAccounts = await query(
      'SELECT email, created_at, is_banned FROM accounts ORDER BY created_at DESC LIMIT 5'
    );

    // Last 5 crime logs
    const recentCrimes = await query(
      `SELECT cl.crime_type, cl.attacker_cnp, cl.success, cl.logged_at,
              CONCAT(c.firstname,' ',c.lastname) AS attacker_name
       FROM crime_logs cl
       LEFT JOIN characters c ON c.cnp = cl.attacker_cnp
       ORDER BY cl.logged_at DESC LIMIT 5`
    );

    const content = `
<div class="page-header">
  <div>
    <div class="page-title">Dashboard</div>
    <div class="page-subtitle">Blackridge City · Live Overview</div>
  </div>
  <span class="badge badge-green">ONLINE</span>
</div>

<div class="stats-grid">
  <div class="stat-card cyan">
    <div class="stat-label">Total Accounts</div>
    <div class="stat-value">${totalAccounts}</div>
    <div class="stat-icon">◈</div>
  </div>
  <div class="stat-card pink">
    <div class="stat-label">Characters</div>
    <div class="stat-value">${totalChars}</div>
    <div class="stat-icon">◆</div>
  </div>
  <div class="stat-card purple">
    <div class="stat-label">Vehicles</div>
    <div class="stat-value">${totalVehicles}</div>
    <div class="stat-icon">◉</div>
  </div>
  <div class="stat-card red">
    <div class="stat-label">Banned</div>
    <div class="stat-value">${totalBanned}</div>
    <div class="stat-icon">✕</div>
  </div>
  <div class="stat-card yellow">
    <div class="stat-label">Active Admins</div>
    <div class="stat-value">${totalAdmins}</div>
    <div class="stat-icon">◐</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap;">

  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">Recent Registrations</span>
      <a href="/players" class="btn btn-ghost btn-sm">View All</a>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr>
          <th>Email</th><th>Registered</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${recentAccounts.length === 0
            ? '<tr><td colspan="3" class="text-muted text-center">No accounts yet</td></tr>'
            : recentAccounts.map(a => `<tr>
              <td>${escHtml(a.email)}</td>
              <td class="muted">${fmtDate(a.created_at)}</td>
              <td>${a.is_banned ? '<span class="badge badge-red">BANNED</span>' : '<span class="badge badge-green">OK</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">Recent Crime Logs</span>
      <a href="/logs" class="btn btn-ghost btn-sm">View All</a>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr>
          <th>Type</th><th>Attacker</th><th>Result</th><th>Time</th>
        </tr></thead>
        <tbody>
          ${recentCrimes.length === 0
            ? '<tr><td colspan="4" class="text-muted text-center">No logs</td></tr>'
            : recentCrimes.map(c => `<tr>
              <td><span class="badge badge-pink">${escHtml(c.crime_type)}</span></td>
              <td>${c.attacker_name ? escHtml(c.attacker_name) : `<span class="mono">${escHtml(c.attacker_cnp)}</span>`}</td>
              <td class="${c.success ? 'crime-success' : 'crime-fail'}">${c.success ? '✓ SUCCESS' : '✗ FAIL'}</td>
              <td class="muted">${fmtDate(c.logged_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

</div>`;

    res.send(renderPage('Dashboard', content, req, { activeNav: 'dashboard' }));
  } catch (err) {
    res.send(renderPage('Dashboard', errorPanel(err), req, { activeNav: 'dashboard' }));
  }
});

// ---- Players ----

app.get('/players', requireAuth, async (req, res) => {
  try {
    const players = await query(`
      SELECT
        c.cnp, c.firstname, c.lastname, c.level, c.cash, c.bank,
        c.job_name, c.play_time, c.last_seen, c.created_at,
        c.is_dead, c.is_jailed, c.wanted_level,
        a.email, a.is_banned, a.id AS account_id
      FROM characters c
      JOIN accounts a ON a.id = c.account_id
      ORDER BY c.last_seen DESC
    `);

    const rows = players.map(p => `
      <tr>
        <td><a href="/player/${encodeURIComponent(p.cnp)}" class="text-cyan" style="text-decoration:none;font-weight:600;">${escHtml(p.firstname)} ${escHtml(p.lastname)}</a></td>
        <td class="mono">${escHtml(p.cnp)}</td>
        <td class="muted truncate" style="max-width:160px;">${escHtml(p.email)}</td>
        <td><span class="badge badge-cyan">LVL ${p.level}</span></td>
        <td>${fmtMoney(p.cash)}</td>
        <td>${fmtMoney(p.bank)}</td>
        <td>${p.job_name ? `<span class="badge badge-purple">${escHtml(p.job_name)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td class="muted">${fmtMins(p.play_time)}</td>
        <td class="muted">${fmtDate(p.last_seen)}</td>
        <td>
          ${p.is_banned
            ? '<span class="badge badge-red">BANNED</span>'
            : '<span class="badge badge-green">OK</span>'}
          ${p.is_jailed ? '<span class="badge badge-yellow" style="margin-left:3px;">JAILED</span>' : ''}
        </td>
        <td>
          <a href="/player/${encodeURIComponent(p.cnp)}" class="btn btn-ghost btn-sm">View</a>
          ${p.is_banned
            ? `<form method="POST" action="/player/${encodeURIComponent(p.cnp)}/unban" style="display:inline;" onsubmit="return confirmAction('Unban this player?')">
                 <button type="submit" class="btn btn-success btn-sm">Unban</button>
               </form>`
            : `<form method="POST" action="/player/${encodeURIComponent(p.cnp)}/ban" style="display:inline;" onsubmit="return confirmAction('Ban this player?')">
                 <button type="submit" class="btn btn-danger btn-sm">Ban</button>
               </form>`}
        </td>
      </tr>`).join('');

    const content = `
<div class="page-header">
  <div>
    <div class="page-title">Players</div>
    <div class="page-subtitle">${players.length} character(s) registered</div>
  </div>
  <div class="search-bar">
    <input id="searchInput" class="input" type="text" placeholder="Search players…" style="max-width:220px;"/>
  </div>
</div>

<div class="table-container">
  <div class="table-toolbar">
    <span class="toolbar-title">ALL CHARACTERS</span>
  </div>
  <div style="overflow-x:auto;">
    <table id="mainTable">
      <thead><tr>
        <th>Name</th><th>CNP</th><th>Email</th><th>Level</th>
        <th>Cash</th><th>Bank</th><th>Job</th>
        <th>Play Time</th><th>Last Seen</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="11" class="text-center text-muted">No characters found</td></tr>'}
      </tbody>
    </table>
  </div>
</div>`;

    res.send(renderPage('Players', content, req, { activeNav: 'players' }));
  } catch (err) {
    res.send(renderPage('Players', errorPanel(err), req, { activeNav: 'players' }));
  }
});

// ---- Player Detail ----

app.get('/player/:cnp', requireAuth, async (req, res) => {
  const { cnp } = req.params;
  try {
    const player = await queryOne(`
      SELECT
        c.*,
        a.email, a.is_banned, a.ban_reason, a.created_at AS acc_created,
        a.last_login, a.last_ip, a.id AS account_id
      FROM characters c
      JOIN accounts a ON a.id = c.account_id
      WHERE c.cnp = ?
    `, [cnp]);

    if (!player) {
      return res.send(renderPage('Player Not Found', `<div class="alert alert-error">Character with CNP <strong>${escHtml(cnp)}</strong> not found.</div>`, req, { activeNav: 'players' }));
    }

    // Inventory
    const inventory = await query(`
      SELECT ci.item_name, ci.quantity, ci.metadata, i.display_name, i.item_type
      FROM character_inventory ci
      LEFT JOIN items i ON i.name = ci.item_name
      WHERE ci.character_id = ?
      ORDER BY i.item_type, ci.item_name
    `, [player.id]);

    // Owned vehicles
    const ownedVehicles = await query(`
      SELECT v.plate, v.vin, v.fuel, v.mileage, v.is_impounded,
             vm.display_name, vm.category
      FROM vehicles v
      JOIN vehicle_models vm ON vm.id = v.model_id
      WHERE v.owner_cnp = ?
      ORDER BY v.purchased_at DESC
    `, [cnp]);

    // Admin record (if any)
    const adminRec = await queryOne('SELECT admin_rank, is_active FROM admins WHERE account_id = ?', [player.account_id]);

    const sex    = player.sex ? 'Female' : 'Male';
    const banned = player.is_banned;

    const invHtml = inventory.length === 0
      ? '<p class="text-muted">No items in inventory.</p>'
      : `<div class="inv-list">${inventory.map(i =>
          `<div class="inv-item">
            <span>${escHtml(i.display_name || i.item_name)}</span>
            <span class="inv-qty">×${i.quantity}</span>
            <span class="badge badge-gray" style="font-size:.65rem;">${escHtml(i.item_type || '?')}</span>
          </div>`).join('')}</div>`;

    const vehRows = ownedVehicles.length === 0
      ? '<tr><td colspan="6" class="text-muted text-center">No vehicles owned</td></tr>'
      : ownedVehicles.map(v => `<tr>
          <td>${escHtml(v.display_name)}</td>
          <td class="mono">${escHtml(v.plate)}</td>
          <td><span class="badge badge-purple">${escHtml(v.category)}</span></td>
          <td>${progressBar(Math.round(v.fuel), 100, 'cyan')} <small class="text-muted">${Math.round(v.fuel)}%</small></td>
          <td class="muted">${Math.round(v.mileage).toLocaleString()} km</td>
          <td>${v.is_impounded ? '<span class="badge badge-red">IMPOUNDED</span>' : '<span class="badge badge-green">FREE</span>'}</td>
        </tr>`).join('');

    const content = `
<div class="page-header">
  <div>
    <div class="page-title">${escHtml(player.firstname)} ${escHtml(player.lastname)}</div>
    <div class="page-subtitle">CNP: <span class="text-cyan">${escHtml(player.cnp)}</span>
      ${adminRec ? ` · ${rankBadge(adminRec.admin_rank)}` : ''}
      ${banned ? ' · <span class="badge badge-red">BANNED</span>' : ''}
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <a href="/players" class="btn btn-ghost btn-sm">← Back</a>
    ${banned
      ? `<form method="POST" action="/player/${encodeURIComponent(cnp)}/unban" onsubmit="return confirmAction('Unban this player?')">
           <button type="submit" class="btn btn-success">Unban</button>
         </form>`
      : `<form method="POST" action="/player/${encodeURIComponent(cnp)}/ban" onsubmit="return confirmAction('Ban ${escHtml(player.firstname)} ${escHtml(player.lastname)}?')">
           <button type="submit" class="btn btn-danger">Ban Account</button>
         </form>`}
  </div>
</div>

<!-- Account Info -->
<div class="panel">
  <div class="panel-header"><span class="panel-title">Account Info</span></div>
  <div class="panel-body">
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-key">Email</div><div class="detail-value">${escHtml(player.email)}</div></div>
      <div class="detail-item"><div class="detail-key">Last IP</div><div class="detail-value mono" style="font-size:.85rem;">${escHtml(player.last_ip)}</div></div>
      <div class="detail-item"><div class="detail-key">Account Created</div><div class="detail-value">${fmtDate(player.acc_created)}</div></div>
      <div class="detail-item"><div class="detail-key">Last Login</div><div class="detail-value">${fmtDate(player.last_login)}</div></div>
      <div class="detail-item"><div class="detail-key">Ban Status</div><div class="detail-value">${banned ? `<span class="badge badge-red">BANNED</span> <span class="text-muted">${escHtml(player.ban_reason || '')}</span>` : '<span class="badge badge-green">OK</span>'}</div></div>
      ${adminRec ? `<div class="detail-item"><div class="detail-key">Admin Rank</div><div class="detail-value">${rankBadge(adminRec.admin_rank)}</div></div>` : ''}
    </div>
  </div>
</div>

<!-- Character Stats -->
<div class="panel">
  <div class="panel-header"><span class="panel-title">Character Stats</span></div>
  <div class="panel-body">
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-key">Full Name</div><div class="detail-value">${escHtml(player.firstname)} ${escHtml(player.lastname)}</div></div>
      <div class="detail-item"><div class="detail-key">CNP</div><div class="detail-value mono" style="color:var(--neon-cyan);">${escHtml(player.cnp)}</div></div>
      <div class="detail-item"><div class="detail-key">Sex / Age</div><div class="detail-value">${sex} · ${player.age} yrs</div></div>
      <div class="detail-item"><div class="detail-key">Level</div><div class="detail-value text-cyan">LVL ${player.level} <span class="text-muted" style="font-size:.8rem;">(${(player.experience||0).toLocaleString()} XP)</span></div></div>
      <div class="detail-item"><div class="detail-key">Play Time</div><div class="detail-value">${fmtMins(player.play_time)}</div></div>
      <div class="detail-item"><div class="detail-key">Last Seen</div><div class="detail-value">${fmtDate(player.last_seen)}</div></div>
      <div class="detail-item"><div class="detail-key">Cash</div><div class="detail-value text-green">${fmtMoney(player.cash)}</div></div>
      <div class="detail-item"><div class="detail-key">Bank</div><div class="detail-value text-cyan">${fmtMoney(player.bank)}</div></div>
      <div class="detail-item"><div class="detail-key">Job</div><div class="detail-value">${player.job_name ? `<span class="badge badge-purple">${escHtml(player.job_name)}</span>` : '—'}</div></div>
      <div class="detail-item"><div class="detail-key">Phone</div><div class="detail-value">${escHtml(player.phone_number) || '—'}</div></div>
      <div class="detail-item"><div class="detail-key">Health</div>
        <div class="detail-value">${progressBar(Math.round(player.health), 200, 'green')} <small class="text-muted">${Math.round(player.health)}/200</small></div></div>
      <div class="detail-item"><div class="detail-key">Armor</div>
        <div class="detail-value">${progressBar(Math.round(player.armor), 100, 'cyan')} <small class="text-muted">${Math.round(player.armor)}/100</small></div></div>
      ${player.hunger != null ? `<div class="detail-item"><div class="detail-key">Hunger</div>
        <div class="detail-value">${progressBar(player.hunger, 100, 'yellow')} <small class="text-muted">${player.hunger}%</small></div></div>` : ''}
      ${player.thirst != null ? `<div class="detail-item"><div class="detail-key">Thirst</div>
        <div class="detail-value">${progressBar(player.thirst, 100, 'cyan')} <small class="text-muted">${player.thirst}%</small></div></div>` : ''}
      <div class="detail-item"><div class="detail-key">Wanted Level</div><div class="detail-value">${player.wanted_level > 0 ? `<span class="badge badge-red">★ ${player.wanted_level}</span>` : '—'}</div></div>
      <div class="detail-item"><div class="detail-key">Jailed</div><div class="detail-value">${player.is_jailed ? `<span class="badge badge-yellow">JAILED · ${fmtMins(player.jail_time)} left</span>` : '—'}</div></div>
      <div class="detail-item"><div class="detail-key">Driving License</div><div class="detail-value">${yesNo(player.has_driving_license)}</div></div>
      <div class="detail-item"><div class="detail-key">Weapon License</div><div class="detail-value">${yesNo(player.has_weapon_license)}</div></div>
      <div class="detail-item"><div class="detail-key">Fishing License</div><div class="detail-value">${yesNo(player.has_fishing_license)}</div></div>
    </div>
  </div>
</div>

<!-- Inventory -->
<div class="panel">
  <div class="panel-header">
    <span class="panel-title">Inventory</span>
    <span class="text-muted" style="font-size:.8rem;">${inventory.length} item type(s)</span>
  </div>
  <div class="panel-body">
    ${invHtml}
  </div>
</div>

<!-- Vehicles -->
<div class="panel">
  <div class="panel-header">
    <span class="panel-title">Owned Vehicles</span>
    <span class="text-muted" style="font-size:.8rem;">${ownedVehicles.length} vehicle(s)</span>
  </div>
  <div style="overflow-x:auto;">
    <table>
      <thead><tr>
        <th>Model</th><th>Plate</th><th>Category</th><th>Fuel</th><th>Mileage</th><th>Status</th>
      </tr></thead>
      <tbody>${vehRows}</tbody>
    </table>
  </div>
</div>`;

    res.send(renderPage(`${player.firstname} ${player.lastname}`, content, req, { activeNav: 'players' }));
  } catch (err) {
    res.send(renderPage('Player Detail', errorPanel(err), req, { activeNav: 'players' }));
  }
});

// ---- Ban / Unban ----

app.post('/player/:cnp/ban', requireAuth, async (req, res) => {
  const { cnp } = req.params;
  try {
    await query(`
      UPDATE accounts a
      JOIN characters c ON c.account_id = a.id
      SET a.is_banned = 1, a.ban_reason = 'Banned via Admin Panel'
      WHERE c.cnp = ?
    `, [cnp]);
    res.redirect(`/player/${encodeURIComponent(cnp)}`);
  } catch (err) {
    res.send(renderPage('Error', errorPanel(err), req));
  }
});

app.post('/player/:cnp/unban', requireAuth, async (req, res) => {
  const { cnp } = req.params;
  try {
    await query(`
      UPDATE accounts a
      JOIN characters c ON c.account_id = a.id
      SET a.is_banned = 0, a.ban_reason = NULL
      WHERE c.cnp = ?
    `, [cnp]);
    res.redirect(`/player/${encodeURIComponent(cnp)}`);
  } catch (err) {
    res.send(renderPage('Error', errorPanel(err), req));
  }
});

// ---- Admins ----

app.get('/admins', requireAuth, async (req, res) => {
  try {
    const admins = await query(`
      SELECT
        ad.id, ad.admin_rank, ad.is_active, ad.notes, ad.created_at,
        a.email, a.id AS account_id,
        a2.email AS granted_by_email,
        GROUP_CONCAT(DISTINCT CONCAT(c.firstname,' ',c.lastname) SEPARATOR ', ') AS char_names
      FROM admins ad
      JOIN accounts a ON a.id = ad.account_id
      LEFT JOIN accounts a2 ON a2.id = ad.granted_by
      LEFT JOIN characters c ON c.account_id = ad.account_id
      GROUP BY ad.id
      ORDER BY FIELD(ad.admin_rank,'owner','co_owner','head_admin','admin','moderator','helper','tester'), a.email
    `);

    const rows = admins.map(adm => `
      <tr>
        <td>${escHtml(adm.email)}</td>
        <td>${escHtml(adm.char_names) || '<span class="text-muted">—</span>'}</td>
        <td>${rankBadge(adm.admin_rank)}</td>
        <td>${adm.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
        <td class="muted">${escHtml(adm.granted_by_email) || '—'}</td>
        <td class="muted">${fmtDate(adm.created_at)}</td>
        <td class="muted truncate">${escHtml(adm.notes) || '—'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="fillRankForm(${adm.account_id}, '${escHtml(adm.email)}', '${adm.admin_rank}')">Edit Rank</button>
        </td>
      </tr>`).join('');

    const rankOptions = ADMIN_RANK_ORDER.map(r =>
      `<option value="${r}">${r.replace(/_/g,' ').toUpperCase()}</option>`
    ).join('');

    const content = `
<div class="page-header">
  <div>
    <div class="page-title">Admin Team</div>
    <div class="page-subtitle">${admins.length} admin(s) registered</div>
  </div>
  <div class="search-bar">
    <input id="searchAdmins" class="input" type="text" placeholder="Search admins…" style="max-width:220px;"/>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start;flex-wrap:wrap;">

  <div class="table-container">
    <div class="table-toolbar"><span class="toolbar-title">ALL ADMINS</span></div>
    <div style="overflow-x:auto;">
      <table id="adminsTable">
        <thead><tr>
          <th>Email</th><th>Characters</th><th>Rank</th><th>Status</th>
          <th>Granted By</th><th>Added</th><th>Notes</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows || '<tr><td colspan="8" class="text-center text-muted">No admins found</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <div class="panel" style="margin-bottom:0;">
    <div class="panel-header"><span class="panel-title">Set Admin Rank</span></div>
    <div class="panel-body">
      <form method="POST" action="/admin/serank" id="rankForm">
        <div class="form-group">
          <label class="form-label">Account ID</label>
          <input id="rankAccountId" name="account_id" class="input" type="number" placeholder="Account ID" required/>
        </div>
        <div class="form-group">
          <label class="form-label">Email (info)</label>
          <input id="rankEmail" class="input" type="text" readonly style="opacity:.5;"/>
        </div>
        <div class="form-group">
          <label class="form-label">New Rank</label>
          <select id="rankSelect" name="rank" class="input">
            ${rankOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes (optional)</label>
          <input name="notes" class="input" type="text" placeholder="Reason / notes…"/>
        </div>
        <button type="submit" class="btn btn-primary w-100" style="margin-top:4px;">Apply Rank</button>
      </form>
    </div>
  </div>

</div>

<script>
function fillRankForm(accId, email, currentRank) {
  document.getElementById('rankAccountId').value = accId;
  document.getElementById('rankEmail').value = email;
  const sel = document.getElementById('rankSelect');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === currentRank) { sel.selectedIndex = i; break; }
  }
  document.getElementById('rankForm').scrollIntoView({behavior:'smooth'});
}
</script>`;

    res.send(renderPage('Admins', content, req, { activeNav: 'admins' }));
  } catch (err) {
    res.send(renderPage('Admins', errorPanel(err), req, { activeNav: 'admins' }));
  }
});

app.post('/admin/serank', requireAuth, async (req, res) => {
  const { account_id, rank, notes } = req.body;
  if (!account_id || !rank) return res.redirect('/admins');

  const validRanks = ADMIN_RANK_ORDER;
  if (!validRanks.includes(rank)) return res.redirect('/admins');

  try {
    // Upsert admin record
    await query(`
      INSERT INTO admins (account_id, admin_rank, notes, is_active)
      VALUES (?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        admin_rank = VALUES(admin_rank),
        notes      = COALESCE(VALUES(notes), notes),
        is_active  = 1
    `, [account_id, rank, notes || null]);

    res.redirect('/admins');
  } catch (err) {
    res.send(renderPage('Admins', errorPanel(err), req, { activeNav: 'admins' }));
  }
});

// ---- Vehicles ----

app.get('/vehicles', requireAuth, async (req, res) => {
  try {
    const vehicles = await query(`
      SELECT
        v.vin, v.plate, v.fuel, v.mileage, v.\`condition\`,
        v.is_impounded, v.purchased_at, v.owner_cnp,
        vm.display_name, vm.category,
        CONCAT(c.firstname,' ',c.lastname) AS owner_name
      FROM vehicles v
      JOIN vehicle_models vm ON vm.id = v.model_id
      JOIN characters c ON c.cnp = v.owner_cnp
      ORDER BY v.purchased_at DESC
    `);

    const rows = vehicles.map(v => `
      <tr>
        <td>${escHtml(v.display_name)}</td>
        <td class="mono">${escHtml(v.plate)}</td>
        <td><span class="badge badge-purple">${escHtml(v.category)}</span></td>
        <td><a href="/player/${encodeURIComponent(v.owner_cnp)}" class="text-cyan" style="text-decoration:none;">${escHtml(v.owner_name)}</a></td>
        <td class="mono" style="font-size:.75rem;">${escHtml(v.vin)}</td>
        <td>${progressBar(Math.round(v.fuel), 100, 'cyan')} <small class="text-muted">${Math.round(v.fuel)}%</small></td>
        <td class="muted">${Math.round(v.mileage).toLocaleString()} km</td>
        <td>${progressBar(Math.round(v.condition), 1000, 'green')} <small class="text-muted">${Math.round(v.condition)}/1000</small></td>
        <td>${v.is_impounded ? '<span class="badge badge-red">IMPOUNDED</span>' : '<span class="badge badge-green">FREE</span>'}</td>
        <td class="muted">${fmtDate(v.purchased_at)}</td>
      </tr>`).join('');

    const content = `
<div class="page-header">
  <div>
    <div class="page-title">Vehicles</div>
    <div class="page-subtitle">${vehicles.length} vehicle(s) registered</div>
  </div>
  <div class="search-bar">
    <input id="searchVehicles" class="input" type="text" placeholder="Search plate, model, owner…" style="max-width:240px;"/>
  </div>
</div>

<div class="table-container">
  <div class="table-toolbar"><span class="toolbar-title">ALL OWNED VEHICLES</span></div>
  <div style="overflow-x:auto;">
    <table id="vehicleTable">
      <thead><tr>
        <th>Model</th><th>Plate</th><th>Category</th><th>Owner</th>
        <th>VIN</th><th>Fuel</th><th>Mileage</th><th>Condition</th><th>Status</th><th>Purchased</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="10" class="text-center text-muted">No vehicles found</td></tr>'}
      </tbody>
    </table>
  </div>
</div>`;

    res.send(renderPage('Vehicles', content, req, { activeNav: 'vehicles' }));
  } catch (err) {
    res.send(renderPage('Vehicles', errorPanel(err), req, { activeNav: 'vehicles' }));
  }
});

// ---- Crime Logs ----

app.get('/logs', requireAuth, async (req, res) => {
  try {
    const logs = await query(`
      SELECT
        cl.id, cl.crime_type, cl.attacker_cnp, cl.victim_cnp,
        cl.amount_stolen, cl.success, cl.logged_at,
        CONCAT(ca.firstname,' ',ca.lastname) AS attacker_name,
        CONCAT(cv.firstname,' ',cv.lastname) AS victim_name
      FROM crime_logs cl
      LEFT JOIN characters ca ON ca.cnp = cl.attacker_cnp
      LEFT JOIN characters cv ON cv.cnp = cl.victim_cnp
      ORDER BY cl.logged_at DESC
      LIMIT 100
    `);

    const rows = logs.map(l => `
      <tr>
        <td class="mono" style="font-size:.72rem;color:var(--text-muted);">#${l.id}</td>
        <td><span class="badge badge-pink">${escHtml(l.crime_type)}</span></td>
        <td>
          ${l.attacker_name
            ? `<a href="/player/${encodeURIComponent(l.attacker_cnp)}" class="text-cyan" style="text-decoration:none;">${escHtml(l.attacker_name)}</a>`
            : `<span class="mono">${escHtml(l.attacker_cnp)}</span>`}
        </td>
        <td>
          ${l.victim_cnp
            ? (l.victim_name
              ? `<a href="/player/${encodeURIComponent(l.victim_cnp)}" class="text-cyan" style="text-decoration:none;">${escHtml(l.victim_name)}</a>`
              : `<span class="mono">${escHtml(l.victim_cnp)}</span>`)
            : '<span class="text-muted">—</span>'}
        </td>
        <td class="${l.amount_stolen > 0 ? 'text-yellow' : 'text-muted'}">${l.amount_stolen > 0 ? fmtMoney(l.amount_stolen) : '—'}</td>
        <td class="${l.success ? 'crime-success' : 'crime-fail'}">${l.success ? '✓ SUCCESS' : '✗ FAIL'}</td>
        <td class="muted">${fmtDate(l.logged_at)}</td>
      </tr>`).join('');

    const content = `
<div class="page-header">
  <div>
    <div class="page-title">Crime Logs</div>
    <div class="page-subtitle">Last ${logs.length} entries</div>
  </div>
  <div class="search-bar">
    <input id="searchLogs" class="input" type="text" placeholder="Search crime type, player…"/>
  </div>
</div>

<div class="table-container">
  <div class="table-toolbar"><span class="toolbar-title">RECENT CRIME LOGS</span></div>
  <div style="overflow-x:auto;">
    <table id="logsTable">
      <thead><tr>
        <th>#</th><th>Crime Type</th><th>Attacker</th><th>Victim</th>
        <th>Amount Stolen</th><th>Result</th><th>Time</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="7" class="text-center text-muted">No crime logs found</td></tr>'}
      </tbody>
    </table>
  </div>
</div>`;

    res.send(renderPage('Crime Logs', content, req, { activeNav: 'logs' }));
  } catch (err) {
    res.send(renderPage('Crime Logs', errorPanel(err), req, { activeNav: 'logs' }));
  }
});

// ---- API — Stats (JSON) ----

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const [accounts, chars, vehicles, banned] = await Promise.all([
      queryOne('SELECT COUNT(*) AS n FROM accounts'),
      queryOne('SELECT COUNT(*) AS n FROM characters'),
      queryOne('SELECT COUNT(*) AS n FROM vehicles'),
      queryOne('SELECT COUNT(*) AS n FROM accounts WHERE is_banned = 1'),
    ]);

    res.json({
      online:           0,         // RageMP doesn't expose this via DB
      total_accounts:   accounts?.n ?? 0,
      total_chars:      chars?.n    ?? 0,
      total_vehicles:   vehicles?.n ?? 0,
      total_banned:     banned?.n   ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  ERROR HELPER
// ============================================================

function errorPanel(err) {
  console.error('[WebPanel Error]', err);
  return `
<div class="alert alert-error">
  <strong>Database Error:</strong> ${escHtml(err.message)}
</div>`;
}

// ============================================================
//  CATCH-ALL 404
// ============================================================

app.use((req, res) => {
  res.status(404).send(renderPage('Not Found', `
<div class="page-header">
  <div class="page-title text-pink">404 — Page Not Found</div>
</div>
<p class="text-muted">The page you requested does not exist.</p>
<a href="/dashboard" class="btn btn-outline mt-2">Go to Dashboard</a>
`, req));
});

// ============================================================
//  STARTUP
// ============================================================

app.listen(PORT, () => {
  console.log(`[NeonSyndicate WebPanel] Running on http://localhost:${PORT}`);
  console.log(`[NeonSyndicate WebPanel] DB: ${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
});
