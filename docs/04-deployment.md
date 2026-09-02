# Billator — Deployment

This is the battle-tested deployment guide for the production system, captured
from the origin session. Billator runs as a single **Next.js standalone** server
inside a **Docker container on a Raspberry Pi 5**, exposed on the LAN and, for
the Home-Assistant iframe use-case, publicly over HTTPS through **Caddy + DuckDNS**.

```
                                   the Internet
                                        │  (80/443 port-forwarded to the Pi)
                                        ▼  rcvjetkovic-billator.duckdns.org
                          ┌─────────────────────────────┐
                          │  Caddy  (systemd, ports 80/443)  │   Let's Encrypt TLS
                          └─────────────┬───────────────┘
                                        │ reverse_proxy
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
         rcvjetkovic-billator.duckdns.org          rcvjetkovic-grafana.duckdns.org
                    │ (localhost:3100)                     │ (localhost:3000)
                    ▼                                       ▼
            Docker: billator (Next standalone)      Docker: grafana
            on ${BILLATOR_PORT:-3000}-> :3000
            volume billator_data:/app/data
```

## LAN topology (real values)

| Item | Value |
| --- | --- |
| Raspberry Pi hostname / LAN IP | `rpi5statistic` / `192.168.1.127` |
| Pi SSH user / port | `rcvjetkovic` / 22 |
| App path on the Pi | `/home/rcvjetkovic/billator` |
| Home Assistant host / IP | `homeassistant.local` / `192.168.1.104` |
| Grafana (host port 3000) | http://192.168.1.127:3000 |
| **Billator (host port 3100)** | **http://192.168.1.127:3100** |
| Billator public HTTPS | https://rcvjetkovic-billator.duckdns.org/ |
| Pi public (egress) IP | `93.136.149.168` |

> **Port 3000 on the Pi is already used by Grafana**, so Billator is published on
> host port **3100** (see `.env.deploy`: `BILLATOR_PORT=3100`).

## 1. Why Docker on the Pi

- Native ARM64 image built **on the Pi** (no cross-compile).
- `better-sqlite3` is a native module; the image ships the build toolchain.
- The SQLite DB + PDF inbox live in a named Docker volume so they survive
  rebuilds and restarts; the app auto-starts on boot thanks to
  `restart: unless-stopped` (not a systemd unit for the app — Docker is the
  automation, and Docker is enabled at boot).

## 2. Repository components that matter

### `.env` (per-host, gitignored, NOT synced by deploy.sh)
Only deployment-critical secrets. Copy `.env.template` → `.env` locally, and to
the Pi's app directory (`/home/rcvjetkovic/billator/.env`):

```ini
STORAGE_MODE=sqlite
GMAIL_ENCRYPTION_KEY=<openssl rand -hex 32>
# Optional favourites:
# NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT  (Web Push; needs HTTPS)
# HA_URL / HA_TOKEN                                                   (HA override; DB settings usually win)
```

### `.env.deploy` (local, gitignored)
Read by `scripts/deploy.sh`:

```bash
PI_HOST=192.168.1.127
PI_USER=rcvjetkovic
PI_PATH=/home/rcvjetkovic/billator
BILLATOR_PORT=3100
```

### `scripts/deploy.sh`
Pushes the code and (re)builds the container remotely:

1. SSH reachability check to `${PI_USER}@${PI_HOST}`.
2. `rsync -az --delete` the project **excluding** `node_modules`, `.next`,
   `data`, `.env*`, `.git`, scanned `bills/`, `*.log`. Existing remote DB/data
   are never deleted (`data/` excluded, not wiped).
3. Runs `cd <PI_PATH> && BILLATOR_PORT=3100 docker compose up --build -d`.

### `docker-compose.yml`
```yaml
services:
  billator:
    image: billator:latest
    build: { context: . , dockerfile: Dockerfile }
    container_name: billator
    ports: ["${BILLATOR_PORT:-3000}:3000"]
    env_file: [.env]
    environment:
      PORT: 3000          # container-internal port; host maps BILLATOR_PORT
      HOSTNAME: 0.0.0.0
      STORAGE_MODE: sqlite
      DB_PATH: /app/data/billator.db
    volumes: [ "billator_data:/app/data" ]
    restart: unless-stopped
    platform: linux/arm64
volumes: { billator_data: {} }
```

### `Dockerfile` — multi-stage
- **deps** (`node:22-alpine`): installs build tools (`python3 make g++`) and
  `npm ci`. Sets the npm registry to the **public** `registry.npmjs.org`
  (the internal registry is unreachable from the Pi).
- **builder**: copies deps, runs `next build` (also installs build tools).
- **runner** (`node:22-alpine`, user `nextjs`): copies
  the **standalone** server + `.next/static` + `public`. **Explicitly copies
  `pdf.worker.mjs`** from `pdfjs-dist/legacy/build` into the runner because
  Next's standalone tracer doesn't include it. Exposes `3000`, volume `/app/data`,
  `CMD ["node","server.js"]`.

## 3. One-time Pi setup

```bash
# apt packages
sudo apt install docker.io docker-compose-v2 caddy
sudo usermod -aG docker <your-user>   # then re-login

# app directory + secrets
mkdir -p /home/rcvjetkovic/billator
scp .env  <user>@rpi5statistic:/home/rcvjetkovic/billator/.env
```

Local prerequisites: `ssh`, `rsync`, and `ssh` keys installed
(`ssh-copy-id <user>@192.168.1.127`).

## 4. Deploy / redeploy

```bash
./scripts/deploy.sh
```

Wait for the build (a few minutes on the Pi). Then verify:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.1.127:3100/api/health   # 200
curl -s  http://192.168.1.127:3100/api/gmail/status                             # JSON ready:true
```

Containers auto-start after the Pi reboots (nightly) because:

```bash
systemctl is-enabled caddy     # enabled
docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' billator   # unless-stopped
```

## 5. Data persistence & editing the DB

- Data lives in volume `billator_data`, mounted at `/app/data`.
- **Editing the DB correctly** (important WAL gotcha): SQLite WAL is
  un-checkpointed, so external edits/reads see stale state while a server holds
  it open.
  1. **Stop** the app or the whole `billator` container.
  2. Open the file and run `PRAGMA wal_checkpoint(TRUNCATE)`.
  3. Then edit/copy the file.

  Because `/app/data` is a named volume, the clean way to inject a DB is:
  ```bash
  docker cp ./billator.db billator:/app/data/billator.db
  docker restart billator
  ```
  Or, while the container is running, `docker exec` editing requires the same
  permission/WAL care as below.

- **SQLite readonly pitfall inside the container:** if the app process (uid
  `nextjs`) is mid-transaction, an external writer that can't attach the WAL
  gets `SQLITE_READONLY`. Stop the container first, or operate on a copied-out
  DB and copy it back, then `docker start`.

### Settings are in the DB, not env
Almost everything is edited in **`/settings`** in the UI. To script a value into
the Pi's DB (e.g. Home Assistant config), use the SQLite adapter via
`better-sqlite3` on the DB file (settings table `key`/`value`), then restart.

```js
const db = new Database('/app/data/billator.db');           // after stopping billator
const set = (k, v) => db.prepare(
  'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
).run(k, v);
set('app.homeAssistant.enabled', 'true');
set('app.homeAssistant.url', 'http://192.168.1.104:8123');  // NB: use an IP, not <name>.local
```

## 6. HTTPS: Caddy + DuckDNS (so it can be iframed into HA)

Home Assistant loads pages/apps in an iframe **inside its HTTPS page**. An
`http://…` iframe is blocked as mixed content, so Billator had to be HTTPS.

### Caddy (systemd on the Pi, ports 80/443)
`/etc/caddy/Caddyfile`:

```plaintext
rcvjetkovic-grafana.duckdns.org {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}

# NEW (Billator) — added in this session
rcvjetkovic-billator.duckdns.org {
    reverse_proxy localhost:3100 {          # Billator host port
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

Apply & (re)load after editing:
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy issues Let's Encrypt certificates automatically. **Gotcha:** the pi's
http-01 challenge timed out, but Caddy fell back to **tls-alpn-01** (port 443)
which succeeded → the certificate is issued and served.

### DuckDNS (dynamic DNS → Pi public IP)

- DuckDNS runs as an add-on **on the Home Assistant node**; it only updates the
  A record of subdomains already registered in your DuckDNS account.
- **A brand-new subdomain must first be created in the duckdns.org web
  dashboard** (the API/add-on cannot create it). An unregistered name makes the
  update return `KO` and DNS report NXDOMAIN.
- Verified account owns (same DuckDNS token): `rcvjetkovic-grafana` and
  (after creation) `rcvjetkovic-billator`, both → `93.136.149.168`.

Manually force an update (from a host without a blocking proxy):
```bash
curl -s "https://www.duckdns.org/update?domains=rcvjetkovic-billator&token=<DUCKDNS_TOKEN>&ip=93.136.149.168"   # → OK
```

> Corporate/filtered networks (the developer's machine) block duckdns.org and
> also post a fake 503 to public DuckDNS hosts. Always validate from the Pi or
> via DNS-over-HTTPS.

## 7. Verifying the public endpoint

- `dig +short rcvjetkovic-billator.duckdns.org` → `93.136.149.168`
- `curl -sI https://rcvjetkovic-billator.duckdns.org/` → `HTTP/200` when reached
  from an unfiltered network.

## 8. Local development (not Docker)

```bash
npm install
cp .env.template .env
npm run dev            # http://localhost:3000
```

The dev server writes `./data/billator.db`. There is also a one-time migration
script for an old file-based store: `node scripts/migrate-filesystem-to-sqlite.js`.

## 9. Backup / restore

- The **SQLite DB** and the **inbox PDFs** are the only state. The DB lives in
  the `billator_data` volume; to back it up, stop the container, checkpoint the
  WAL, and copy `billator.db` out.
- One-off Excel helpers live in `scripts/import-xlsx.mjs` (a standalone CLI that
  uses `better-sqlite3` + `xlsx` and skips duplicate `period_start` rows).
