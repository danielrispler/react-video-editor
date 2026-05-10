<p align="center">
  <a href="https://github.com/designcombo/react-video-editor">
    <img width="150px" height="150px" src="https://cdn.designcombo.dev/combo-logo-black.png"/>
  </a>
</p>
<h1 align="center">React Video Editor</h1>

<div align="center">
  
Video Editor application using React and TypeScript.

<p align="center">
    <a href="https://designcombo.dev/">Combo</a>
    ·  
    ·  
    <a href="https://github.com/designcombo/react-video-editor">X</a>
</p>
</div>

[![](./images/combo.png)](https://github.com/designcombo/react-video-editor)

## ✨ Features

- 🎬 Timeline Editing: Arrange and trim media on a visual timeline.
- 🌟 Effects and Transitions: Apply visual effects, filters, and transitions.
- 🔀 Multi-track Support: Edit multiple video and audio tracks simultaneously.
- 📤 Export Options: Save videos in various resolutions and formats.
- 👀 Real-time Preview: See immediate previews of edits.

## 🚀 See It in Action

Check out the deployed version here: [React Video Editor Live Demo](https://video.designcombo.dev/)

## ⌨️ Development

### Environment Variables

The new server lives in `apps/server`. Create `apps/server/.env` and add the following:

```env
PEXELS_API_KEY=""
PORT="4000"
HOST="127.0.0.1"
S3_BUCKET="video-editor"
S3_REGION="us-east-1"
S3_ENDPOINT="http://127.0.0.1:9000"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin123"
S3_FORCE_PATH_STYLE="true"
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
REDIS_PASSWORD=""
```

Start the local infrastructure before running the app. The new server requires both MinIO and Redis:

```bash
docker compose up -d
```

Clone locally:

```bash
git clone git@github.com:designcombo/react-video-editor.git
cd react-video-editor
pnpm install
pnpm dev
```

Or run the apps separately:

```bash
pnpm -F frontend dev
pnpm -F server dev
```

Open your browser at `http://localhost:3000`.

### Iframe Demo Flow

To test the full iframe preview flow without the real channel API:

1. Start the local infra and apps:

```bash
docker compose up -d
pnpm install
pnpm -F server dev
pnpm -F @video-editor/frontend dev
```

2. Open `http://localhost:3000/editor/iframe-demo`.

3. Use the built-in demo recording values:

```text
channelId: demo-recording
startTimeMs: 1778412276333
endTimeMs: 1778412295000
```

The iframe sends `EDITOR_ADD_PREVIEW_ITEM`, the editor calls
`POST /api/editor/preview-source`, the backend converts a local demo DASH MPD
into HLS, stores the generated playlist, and inserts the HLS item into the
editor scene.

## 📝 License

Copyright © 2025 [DesignCombo](https://designcombo.dev/).
