# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

pnpm + Turborepo monorepo. Workspace root is `apps/*`.

```
apps/
  frontend/   — Vite + React 19 + React Router v7 (port 3000)
  backend/    — Fastify + Node.js (port 3001)
```

## Repo Rules

- Backend runtime is Node.js `22.18+`.
- use only imports with .ts and not .js
- Backend TypeScript is executed directly with Node.js. Do not introduce `tsx`/`ts-node` for normal app execution.
- After each completed prompt, run `lint` and `build` before finishing.

## Commands

```bash
# Root — runs both apps in parallel via Turborepo
pnpm dev
pnpm lint
pnpm build

# Per-app
cd apps/frontend && pnpm dev
cd apps/backend  && pnpm dev    # node runs TypeScript directly in watch mode

# Type check
cd apps/frontend && npx tsc --noEmit
cd apps/backend  && npx tsc --noEmit

# Format (biome)
pnpm format
```

## Local Dev Setup

MinIO (S3-compatible storage) must be running before the app works:

```bash
docker compose up -d
```

Copy `apps/backend/.env.example` → `apps/backend/.env` and fill in values. Frontend needs no `.env` in dev — Vite proxies `/api` to `http://localhost:3001`.

## Architecture

### Frontend (`apps/frontend`)

**Entry:** `src/main.tsx` — mounts React, wraps with `BrowserRouter`, `ThemeProvider`, `QueryProvider`.

**Routing:** React Router v7. Two routes in `src/App.tsx`:
- `/` → `src/pages/Home.tsx`
- `/edit/:id` → `src/pages/EditPage.tsx`

**Path alias:** `@/` maps to `apps/frontend/src/`.

**Core feature — Editor:** `src/features/editor/` is the entire video editing UI. Key files:
- `editor.tsx` — root component, accepts optional `id` prop (scene ID)
- `navbar.tsx` — top bar
- `scene/` — canvas rendering area (Moveable/Selecto drag-select)
- `timeline/` — timeline scrubber, built on `@designcombo/timeline`
- `player/` — Remotion `<Player>` and `<Composition>` with all track renderers
- `menu-item/` — left panel (videos, images, audio, text, uploads, etc.)
- `control-item/` — right panel (per-type property controls)
- `store/` — six Zustand stores (main editor state, uploads, layout, crop, data, folder)

**State management:** Zustand (`src/features/editor/store/`). Global scene store at `src/store/use-scene-store.ts`.

**Data fetching:** React Query via `src/components/query-provider.tsx`.

**Uploads:** `src/utils/upload-service.ts` — routes file/URL uploads to `POST /api/uploads/file` or `POST /api/uploads/url`. UserId is currently hardcoded.

**Styling:** Tailwind v4 + shadcn/ui (new-york style). CSS variables for theming in `src/globals.css`. Dark mode via `next-themes`.

### Backend (`apps/backend`)

**Runtime:** Node.js `22.18+` with direct TypeScript execution.

**Entry:** `src/index.ts` — Fastify server with CORS + multipart plugins.

**Routes (all prefixed `/api`):**
| Path | File | Notes |
|------|------|-------|
| `/api/uploads/file` | `routes/uploads.ts` | Multipart file → S3 |
| `/api/uploads/url` | `routes/uploads.ts` | Remote URL → S3 |
| `/api/uploads/presign` | `routes/uploads.ts` | Generate presigned PUT URL |
| `/api/render` | `routes/render.ts` | Proxy to api.designcombo.dev |
| `/api/pexels` | `routes/pexels.ts` | Proxy to Pexels photos API |
| `/api/pexels-videos` | `routes/pexels.ts` | Proxy to Pexels videos API |
| `/api/voices` | `routes/voices.ts` | Proxy to dubbing service |
| `/api/transcribe` | `routes/transcribe.ts` | Proxy to designcombo STT |

**Storage:** `src/lib/storage.ts` — AWS SDK v3 S3 client. Works with MinIO locally (path-style URLs). All env vars are `S3_*`.

## Key External Dependencies

- **`@designcombo/*`** — proprietary packages (state, timeline, transitions, animations, frames, events, types). Core to editor behavior.
- **Remotion** — video composition and rendering engine. Player renders the canvas; `@remotion/renderer` for export.
- **`@fastify/multipart`** — file upload handling (500 MB limit).
