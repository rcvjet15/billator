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
   Default query: `from:hep.hr has:attachment is:unread` (configurable).

## Tariff prices

`Settings → HEP sync → Sync official prices` loads a hand-curated baseline
(the latest household rates). There is no official HEP price API, so the
template is maintained in `src/lib/pricing-baseline.ts`; you can also point it
at a JSON URL you control via `Settings → HEP sync → Source URL`.
