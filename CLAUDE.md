# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
The project production will be in closed network environments and not exposed to the public internet.

## Monorepo Structure

pnpm + Turborepo monorepo. Workspace root is `apps/*` and `packages/*`.

```
apps/
  frontend/   — Vite + React 19 + React Router v7 (port 3000)
  server/     — Fastify + Node.js (port 4000)
packages/
  editor-contract/  — shared postMessage contract (@video-editor/iframe-contract)
```

## Repo Rules

- Server runtime is Node.js `22.18+`.
- Use `pnpm` for all package management. Add dependencies with `pnpm add` or `pnpm add -D`, and do not use `npm`.
- Use only imports with `.ts` and not `.js`.
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

# Tests (Node.js built-in test runner)
cd apps/server && node --test src/**/*.test.ts
cd packages/editor-contract && pnpm test   # builds then runs dist/**/*.test.js
```

## Local Dev Setup

MinIO (S3-compatible storage) and Redis must be running before the app works:

```bash
docker compose up -d
```

Configure `apps/server/.env`. Frontend needs no `.env` in dev. The server defaults to `http://localhost:4000`, and Vite proxies `/api` there during local development.

**Optional frontend env:**
- `VITE_EDITOR_PARENT_ORIGINS` — comma-separated allowed origins for iframe postMessage (required when embedding the editor in an iframe).

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

**Iframe embedding (`external-preview/`):** When the editor is embedded in an `<iframe>`, `useEditorPostMessage` hook (called in `editor.tsx`) listens for `window.postMessage` from the parent page. Uses `@video-editor/iframe-contract` for typed message schemas. Supported messages:
- `EDITOR_ADD_PREVIEW_ITEM` — adds a video/audio track item at the end of the timeline; supports `recording-range` (HLS), `media` (mp4/hls), and `audio-range` payloads.
- `EDITOR_CLEAR_PROJECT` — wipes all tracks and resets duration.

Responses are sent back via `postMessage` to the parent. Allowed origins are configured via `VITE_EDITOR_PARENT_ORIGINS` (defaults to `window.location.origin`).

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

**Source processing (`src/services/sources/`):** Handles heterogeneous video inputs before FFmpeg processing:
- `process-sources.service.ts` — dispatches to per-type handlers; supports single-source trim and multi-source concatenation.
- `hls-process.service.ts` — transcodes HLS (`.m3u8`) streams to MP4 via FFmpeg.
- `dash-process.service.ts` — handles MPEG-DASH (`.mpd`) sources.
- `image-process.service.ts` — converts images to video segments.
- `audio-process.service.ts` — processes audio-only sources.
- `internal://blank` URL scheme generates a silent black video segment of specified dimensions.

**Storage:** `src/plugins/storage.plugin.ts` — AWS SDK v3 S3 client, configured for MinIO locally via `S3_*` env vars.
**State:** Redis is required for render/edit job status.

**Tests:** Use Node.js built-in test runner (`node:test` / `node:assert`). Test files are co-located with source as `*.test.ts`.

### Packages (`packages/editor-contract`)

Published as `@video-editor/iframe-contract`. Defines Zod schemas and TypeScript types for the postMessage protocol between the editor iframe and its parent page. Key exports:
- `parentToEditorMessageSchema` — Zod schema for messages the editor receives.
- Message types: `ParentToEditorMessage`, `EditorToParentMessage` and their subtypes.
- `createPreviewItemAddedMessage`, `createPreviewItemRejectedMessage`, `createProjectClearedMessage` — response factories.
- `PreviewItemPayload` — union of `recording-range`, `media`, and `audio-range` payload shapes.

Build: `pnpm build` in the package directory. Exports point directly to `src/` (no separate build required for development via `exports` field in `package.json`).

## Key External Dependencies

- **`@designcombo/*`** — proprietary packages (state, timeline, transitions, animations, frames, events, types). Core to editor behavior.
- **Remotion** — video composition and rendering engine. Player renders the canvas; `@remotion/renderer` for export.
- **`@fastify/multipart`** — file upload handling (500 MB limit).
- **`fluent-ffmpeg`** — FFmpeg wrapper used throughout server source processing and overlay pipelines.
