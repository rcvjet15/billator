# Billator Deployment & Setup

Billator runs as a single Node/Next.js app backed by SQLite. It is built for
local home-server hosting (e.g. a Raspberry Pi 5) but runs identically on any
machine with Node or Docker.

## Local development (Mac/PC)

```
npm install
cp .env.template .env
npm run dev        # http://localhost:3000
```

- Data persists to `./data/billator.db` (SQLite).
- Configuration lives in the **Settings** page (`/settings`, tabbed), not env.
- If you previously used `data/store.json`, migrate it once:
  `node scripts/migrate-filesystem-to-sqlite.js`

## Deploying to a Raspberry Pi (Docker + SSH)

### 1. Prerequisites on the Pi
- Docker + the Compose plugin: `sudo apt install docker.io docker-compose-v2`
- Your user in the `docker` group, and outbound network to Docker Hub.

### 2. One-time remote setup
- Create `/home/pi/billator/.env` on the Pi with the same values as your local
  `.env` (especially `GMAIL_ENCRYPTION_KEY`). The deploy script does **not**
  sync `.env` (it stays on each host):
  ```
  ssh pi@pi5.local 'mkdir -p ~/billator'
  scp .env pi@pi5.local:~/billator/.env
  ```

### 3. Deploy
```
cp .env.deploy.example .env.deploy   # set PI_HOST / PI_USER / PI_PATH
./scripts/deploy.sh
```
This rsyncs the project (excluding `node_modules`, `.next`, `data`, `.env`,
`.git`, scanned `bills/`) to the Pi and runs `docker compose up --build -d`.
The image builds **on the Pi** (native ARM64). SQLite data lives in the
`billator_data` Docker volume, so it survives rebuilds/restarts.

View logs:
```
ssh pi@pi5.local 'cd ~/billator && docker compose logs -f'
```

## Gmail invoice sync (optional but recommended)

1. **Google Cloud OAuth client**
   - Create an OAuth 2.0 *Web application* credential in Google Cloud Console.
   - Add an authorized redirect URI: `http://<your-app>/api/gmail/auth/callback`
     (e.g. `http://pi5.local:3000/api/gmail/auth/callback`).
2. **Settings → Gmail** in the app:
   - Enable sync, enter the Client ID and Client secret.
   - Set the Redirect URI to match step 1.
   - Save.
3. **Connect account**: visit `http://<your-app>/api/gmail/auth` and approve
   the consent. The refresh token is stored **encrypted** in the DB (keyed by
   `GMAIL_ENCRYPTION_KEY`).
4. The background worker polls unread HEP emails with PDF attachments, saves
   them to the inbox (`/sync`), marks them read, and logs each run.
   Default query: `from:elektra.racuni-RI@hep.hr has:attachment` (no unread
   dependency; dedup is by message id).

### PWA / Web Push notifications

The app is a PWA (installable) and can send native push alerts when a new HEP
bill is synced/parsed.

- **Requires HTTPS (or localhost).** Service workers and the Web Push API are
  only available in a secure context. On `localhost` (dev) push works out of
  the box. On the Raspberry Pi served over plain `http://<pi-ip>:3000` it is
  blocked until you add TLS (e.g. reverse-proxy with Caddy/nginx, or a domain).
- **VAPID keys** in the Pi's `.env` (generate with
  `npx web-push generate-vapid-keys`):
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=`
  - `VAPID_PRIVATE_KEY=`
  - `VAPID_SUBJECT=mailto:you@example.com`
- Enable in **Settings → Gmail → Push notifications** (permission + subscribe),
  then use **Send test** to verify.
- Push is sent when a **new invoice is downloaded** and when a **parsed PDF is
  turned into a reading**.

### Host-specific redirect URI (local vs Raspberry Pi)

The OAuth client's **Authorized redirect URIs in Google Cloud** must exactly
match the app's `redirectUri` setting, and that setting must match the host
the app runs on:

- **Localhost**: `http://localhost:3000/api/gmail/auth/callback`
- **Raspberry Pi**: `http://<pi-host>:3000/api/gmail/auth/callback`
  (e.g. `http://pi5.local:3000/api/gmail/auth/callback`)

Before authorizing on the Pi:
1. Add the Pi's URL to the OAuth client's **Authorized redirect URIs** in
   Google Cloud Console (in addition to the localhost one).
2. Set the app's **Settings → Gmail → Redirect URI** to that same Pi URL.

The refresh token is tied to the **OAuth client** (Client ID/Secret), not the
redirect URI — so a token obtained on localhost keeps working on the Pi as
long as you use the same OAuth client. Re-authorization is only needed if you
switch clients or clear the stored token.

## Tariff prices

`Settings → HEP sync → Sync official prices` loads a hand-curated baseline
(the latest household rates). There is no official HEP price API, so the
template is maintained in `src/lib/pricing-baseline.ts`; you can also point it
at a JSON URL you control via `Settings → HEP sync → Source URL`.
