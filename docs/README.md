# Billator — Documentation

Billator is a self-hosted web app that splits the Croatian HEP electricity bill
between the **ground floor** and **upper floor** of a two-floor house, correctly
handling HEP's rolling **6-month, 3,000 kWh semi-annual tariff** and its **35%
overage penalty**.

This directory documents how Billator works and how it is run in the real
deployment. It was written after a long working session that rebuilt the data
model, added Home Assistant notifications, and deployed Billator to a Raspberry
Pi behind an HTTPS reverse proxy.

## Contents

| Document | What it covers |
| --- | --- |
| [01-business-logic.md](./01-business-logic.md) | The domain model and how the bill split is calculated. |
| [02-features.md](./02-features.md) | Every user-facing feature, page by page. |
| [03-architecture.md](./03-architecture.md) | Tech stack and code structure (Next.js, adapters, calc engine, PDF parsing, notifications). |
| [04-deployment.md](./04-deployment.md) | Local dev + Raspberry Pi Docker deployment in detail, plus HTTPS via Caddy & DuckDNS. |
| [05-home-assistant.md](./05-home-assistant.md) | Sending notifications through Home Assistant's REST API. |
| [06-session-record.md](./06-session-record.md) | Chronological record of everything done in the origin session. |

## Quick facts

- **Environment:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · SQLite (`better-sqlite3`) · Vitest. Runs as a Docker container on a Raspberry Pi 5 (ARM64).
- **Production:** Dockerized on the Pi at `http://192.168.1.127:3100`, publicly reachable over HTTPS at `https://rcvjetkovic-billator.duckdns.org/` via Caddy + DuckDNS.
- **Data:** one **reading** per billing period holds two independent meters:
  - `hep_*` — the whole-house HEP meter (from the invoice PDF).
  - `upper_*` — the **upper-floor submeter** (from a hand-maintained Excel sheet, imported as monthly kWh deltas).
- **Git:** this repo is a normal git checkout; `data/` (the SQLite DB + PDF inbox) and all `.env*` are gitignored.

> Some config values (IPs, hostnames, tokens) below are **real values** captured
> from the working home deployment. Treat anything under "Secrets" as private —
> the DuckDNS and Home Assistant tokens were regenerated after the session.
