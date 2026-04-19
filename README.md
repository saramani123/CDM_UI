# CDM Screens — Canonical Data Model platform

Monorepo for the CDM management UI: a **React + Vite** frontend and a **FastAPI** backend backed by **Neo4j** (typically Neo4j Aura for cloud).

## Repository layout

| Path | Role |
|------|------|
| `CDM_Frontend/` | React, TypeScript, Tailwind; talks to the backend over HTTP |
| `CDM_UI_Backend/` | FastAPI app, Neo4j access, CSV/upload and domain routes |

Root helper scripts (when present) include `start_dev.sh` for local full-stack startup.

## Local development

**Quick start (both apps):**

```bash
git checkout dev   # recommended for day-to-day work
./start_dev.sh
```

**URLs (as configured in this repo):**

- Frontend: `http://localhost:5178` (`CDM_Frontend/vite.config.ts`)
- Backend: `http://localhost:10000` (`CDM_UI_Backend/main.py` via uvicorn)
- API docs: `http://localhost:10000/docs`
- Health: `http://localhost:10000/health`

**Run services individually:**

```bash
# Backend
cd CDM_UI_Backend
pip install -r requirements.txt
cp env.example .env   # then set Neo4j credentials
python main.py

# Frontend (separate terminal)
cd CDM_Frontend
npm install
npm run dev
```

Frontend API base URL is usually configured with `VITE_API_BASE_URL` (e.g. `http://localhost:10000/api/v1` for local backend).

## Environment variables (backend)

Configure in `CDM_UI_Backend/.env` (see `env.example`). Typical keys:

| Variable | Purpose |
|----------|---------|
| `NEO4J_URI` | Bolt / Aura URI (e.g. `neo4j+s://…databases.neo4j.io`) |
| `NEO4J_USERNAME` | Neo4j user |
| `NEO4J_PASSWORD` | Neo4j password |
| `ENVIRONMENT` | e.g. `development` / `production` (used for behavior and UI hints) |
| `NEO4J_INSTANCE_NAME` | Label for logging / env indicator (instance nickname) |
| `DATABASE_URL` | **PostgreSQL** connection string (Render injects this when you attach a Postgres instance). Used for **Metadata**, **Heuristics**, and **Sources** (catalog + LDM rows) when the backend enables Postgres (see below). |
| `RENDER` | Set automatically on **Render** Web Services. With `DATABASE_URL`, the backend persists Sources LDM data and related tables in Postgres instead of JSON files. |
| `FORCE_POSTGRES` | Optional: set to `1` / `true` / `yes` if you deploy somewhere that provides `DATABASE_URL` but does not set `RENDER`, to force Postgres instead of JSON. |

**Sources on Render:** Link your Render PostgreSQL add-on so `DATABASE_URL` is available to the CDM backend service, deploy from `main`, and ensure `requirements.txt` is installed (includes `sqlalchemy`, `psycopg2-binary`). Local development without `RENDER` / `FORCE_POSTGRES` continues to use `cdm_sources_store.*.json` for Sources.

Never commit real `.env` files or passwords. Rotate any credentials that were ever committed to git.

## Backend API (overview)

The FastAPI app mounts routes under `/api/v1`. Route modules include **objects**, **drivers**, **variables**, **lists**, **graph**, **order**, **metadata**, **heuristics**, and **sources**. For the live contract, use **`/docs`** on a running server.

Legacy READMEs claimed only placeholder object routes; the implementation is Neo4j-backed — treat OpenAPI as source of truth.

## Branching and deployment (typical)

- **`main`** — production releases (exact hostnames depend on your Render/Vercel setup).
- **`dev`** — integration branch for local and pre-prod work.

Deployment steps vary by host (Render static site + web service vs Vercel, etc.). Additional checklists and migration notes live in other markdown files at repo and `CDM_UI_Backend/` roots until those are consolidated in a later cleanup.

## Optional one-off Neo4j / data maintenance scripts

These live in `CDM_UI_Backend/`. Always use a **dry run** when the script supports it, test against **non-production** first, and take a **backup** before mutating production.

| Script | Purpose |
|--------|---------|
| `normalize_variable_driver_strings.py` | Normalizes variable `driver` strings so “all sectors/domains/countries” become `ALL` in stored text (relationships unchanged). Run without flags for dry run; `--apply` to write. |
| `fix_object_driver_relationships.py` | Aligns object `RELEVANT_TO` driver relationships with the object `driver` string; `--dry-run` to preview. For `ALL` in the string, relates the object to **all** real driver nodes — never to a fake `"ALL"` node. |
| `fix_all_node_relationships.py` | Removes erroneous **Sector/Domain/Country** nodes named `ALL`, rewires entities to real drivers, then deletes `ALL` nodes. Idempotent; still treat as dangerous on prod without a backup. |

Older standalone READMEs described an `delete_all_objects.py` flow; that file is **not** in this tree. Use the UI/API, or inspect maintenance scripts such as `clean_and_setup_fresh.py` / `cleanup_object_relationships.py` only if you understand what they delete.

## Additional documentation (not merged here yet)

Other markdown files in the repo (deployment checklists, Render migration, cypher notes, feature status, etc.) are still available for reference. Prefer this `README.md` for onboarding; treat topic-specific files as deep dives and verify dates/URLs against your current infrastructure.

## Package-level READMEs

`CDM_Frontend/README.md` and `CDM_UI_Backend/README.md` are short pointers to this file to avoid duplicated or outdated instructions.
