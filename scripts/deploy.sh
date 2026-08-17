#!/usr/bin/env bash
#
# Deploy Billator to a local Raspberry Pi over SSH.
#
# Reads target details from environment variables OR a local .env.deploy file:
#   PI_HOST   (e.g. pi5.local or 192.168.1.50)
#   PI_USER   (default: pi)
#   PI_PATH   (default: ~/billator)
#
# Flow:
#   1. rsync the project to the Pi (excluding data/state and secrets)
#   2. run `docker compose up --build -d` on the Pi
#
# Requirements on the Pi: Docker + Docker Compose plugin, SSH, and rsync on the
# local machine.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---- load .env.deploy if present (gitignored) ---------------------------
if [ -f "$PROJECT_DIR/.env.deploy" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env.deploy"
  set +a
fi

PI_HOST="${PI_HOST:-pi5.local}"
PI_USER="${PI_USER:-pi}"
PI_PATH="${PI_PATH:-~/billator}"

# ---- pre-flight checks --------------------------------------------------
for cmd in ssh rsync; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: '$cmd' not found on this machine." >&2
    exit 1
  fi
done

echo "→ Reaching $PI_USER@$PI_HOST ..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${PI_USER}@${PI_HOST}" 'echo ok' >/dev/null 2>&1; then
  echo "ERROR: cannot SSH to ${PI_USER}@${PI_HOST}. Check PI_HOST/PI_USER and SSH keys." >&2
  exit 1
fi

REMOTE_PROJECT="${PI_PATH}"
echo "→ Syncing project to ${PI_USER}@${PI_HOST}:${REMOTE_PROJECT}"

# Ensure remote dir exists.
ssh "${PI_USER}@${PI_HOST}" "mkdir -p ${REMOTE_PROJECT}"

# Sync source; keep local data/secrets off the Pi and never delete remote data.
rsync -az --delete \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'data/' \
  --exclude 'bills/' \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude '.env.deploy' \
  --exclude '*.log' \
  "$PROJECT_DIR/" \
  "${PI_USER}@${PI_HOST}:${REMOTE_PROJECT}/"

echo "→ Building & starting containers on the Pi (this may take a few minutes)..."
ssh "${PI_USER}@${PI_HOST}" \
  "cd ${REMOTE_PROJECT} && docker compose up --build -d"

echo ""
echo "✅ Deployed. App should be at http://${PI_HOST}:3000"
echo "   Logs:  ssh ${PI_USER}@${PI_HOST} 'cd ${REMOTE_PROJECT} && docker compose logs -f billator'"
