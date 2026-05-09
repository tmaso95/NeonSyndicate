# Neon Syndicate — Web Admin Panel

Node.js / Express admin panel for the Neon Syndicate RageMP server.

---

## Requirements

- Node.js 18+
- MySQL 8.x (same instance as the game server)
- The `neonsyndicate` database populated via `database/schema.sql` + `database/schema_v2.sql`

---

## Setup

```bash
cd /home/user/NeonSyndicate/webpanel
npm install
```

---

## Configuration

All config is done via environment variables. You can create a `.env` file in the `webpanel/` directory (it is loaded automatically by `dotenv`):

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=yourpassword
DB_NAME=neonsyndicate

# Panel
PANEL_SECRET=ns_admin_2026
PANEL_PORT=8080
SESSION_SECRET=change_this_to_something_random
```

| Variable        | Default           | Description                          |
|-----------------|-------------------|--------------------------------------|
| `DB_HOST`       | `127.0.0.1`       | MySQL host                           |
| `DB_PORT`       | `3306`            | MySQL port                           |
| `DB_USER`       | `root`            | MySQL username                       |
| `DB_PASS`       | *(empty)*         | MySQL password                       |
| `DB_NAME`       | `neonsyndicate`   | Database name                        |
| `PANEL_SECRET`  | `ns_admin_2026`   | Login password for the web panel     |
| `PANEL_PORT`    | `8080`            | HTTP port to listen on               |
| `SESSION_SECRET`| `ns_session_key_x92f` | Express session encryption key   |

> **Security:** Change `PANEL_SECRET` and `SESSION_SECRET` before exposing the panel to any network.

---

## Running

### Development (direct)

```bash
node index.js
```

### With PM2 (recommended for production)

```bash
npm install -g pm2
pm2 start index.js --name ns-webpanel
pm2 save
pm2 startup   # follow the output instructions to auto-start on boot
```

### With systemd

Create `/etc/systemd/system/ns-webpanel.service`:

```ini
[Unit]
Description=Neon Syndicate Web Panel
After=network.target mysql.service

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/NeonSyndicate/webpanel
EnvironmentFile=/home/user/NeonSyndicate/webpanel/.env
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ns-webpanel
sudo systemctl start ns-webpanel
sudo systemctl status ns-webpanel
```

---

## Access

Open `http://YOUR_SERVER_IP:8080` in your browser.

Log in with the value set in `PANEL_SECRET` (default: `ns_admin_2026`).

---

## Routes

| Route                     | Method | Description                                          |
|---------------------------|--------|------------------------------------------------------|
| `/`                       | GET    | Redirect to `/login` or `/dashboard`                 |
| `/login`                  | GET    | Login page                                           |
| `/login`                  | POST   | Submit secret key                                    |
| `/logout`                 | GET    | Clear session, redirect to login                     |
| `/dashboard`              | GET    | Overview stats + recent activity                     |
| `/players`                | GET    | All characters with search and ban/unban buttons     |
| `/player/:cnp`            | GET    | Detailed player page (stats, inventory, vehicles)    |
| `/player/:cnp/ban`        | POST   | Set `is_banned=1` on associated account              |
| `/player/:cnp/unban`      | POST   | Set `is_banned=0` on associated account              |
| `/admins`                 | GET    | Admin team list + set rank form                      |
| `/admin/serank`           | POST   | Upsert admin rank for an account                     |
| `/vehicles`               | GET    | All owned vehicles with owner info                   |
| `/logs`                   | GET    | Last 100 crime log entries                           |
| `/api/stats`              | GET    | JSON: `{ online, total_accounts, total_chars, total_vehicles, total_banned }` |

---

## File Structure

```
webpanel/
├── index.js          # Main Express app (all routes + inline HTML templates)
├── package.json
├── .env              # Your local config (create this, not committed)
├── public/
│   └── style.css     # Cyberpunk neon theme
└── README.md
```

---

## Notes

- The `online` field in `/api/stats` always returns `0`. RageMP does not store active player counts in the database; you would need to query the RageMP server API or a shared memory/Redis cache from your server package.
- Sessions last 8 hours by default.
- The panel does not use a template engine — all HTML is rendered with ES6 template literals in `index.js`.
