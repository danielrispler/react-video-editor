# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

pnpm + Turborepo monorepo. Workspace root is `apps/*`.

```
apps/
  frontend/   — Vite + React 19 + React Router v7 (port 3000)
  server/     — Fastify + Node.js (port 4000)
```

## Repo Rules

- Server runtime is Node.js `22.18+`.
- Use `pnpm` for all package management. Add dependencies with `pnpm add` or `pnpm add -D`, and do not use `npm`.
- use only imports with .ts and not .js
- Server TypeScript is executed directly with Node.js. Do not introduce `tsx`/`ts-node` for normal app execution.
- After each completed prompt, run `lint` and `build` before finishing.

## Commands

```bash
# Root — runs both apps in parallel via Turborepo
pnpm dev
pnpm lint
pnpm build

# Per-app
cd apps/frontend && pnpm dev
cd apps/server   && pnpm dev    # node runs TypeScript directly in watch mode

# Type check
cd apps/frontend && pnpm exec tsc --noEmit
cd apps/server   && pnpm exec tsc --noEmit

# Format (biome)
pnpm format
```

## Local Dev Setup

MinIO (S3-compatible storage) and Redis must be running before the app works:

```bash
docker compose up -d
```

Configure `apps/server/.env`. Frontend needs no `.env` in dev. The server defaults to `http://localhost:4000`, and Vite proxies `/api` there during local development.

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

### Server (`apps/server`)

**Runtime:** Node.js `22.18+` with direct TypeScript execution.

**Entry:** `src/index.ts` — boots `Server`, which configures Fastify, env loading, storage, Redis, and route registration.

**Routes (all prefixed `/api`):**
| Path | File | Notes |
|------|------|-------|
| `/api/edit-video` | `src/edit-video/edit-video.routes.ts` | Start edit-video processing job |
| `/api/edit-video/progress/:jobId` | `src/edit-video/edit-video.routes.ts` | Read job progress from Redis |
| `/api/render` | `src/render/render.routes.ts` | Start render job |
| `/api/render` (GET) | `src/render/render.routes.ts` | Read render status |
| `/api/upload/signed-url` | `src/upload/upload.routes.ts` | Generate signed upload URL |
| `/api/uploads/file` | `src/upload/upload.routes.ts` | Multipart file upload to S3 |
| `/api/cleanup` | `src/upload/upload.routes.ts` | Remove uploaded assets |

**Storage:** `src/plugins/storage.plugin.ts` — AWS SDK v3 S3 client, configured for MinIO locally via `S3_*` env vars.
**State:** Redis is required for render/edit job status.

## Key External Dependencies

- **`@designcombo/*`** — proprietary packages (state, timeline, transitions, animations, frames, events, types). Core to editor behavior.
- **Remotion** — video composition and rendering engine. Player renders the canvas; `@remotion/renderer` for export.
- **`@fastify/multipart`** — file upload handling (500 MB limit).
