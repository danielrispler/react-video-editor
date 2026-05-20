import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { EnvConfig } from "../config/env.ts";
import { createFastifyInstance } from "../fastify/fastify.ts";
import {
	DEMO_PREVIEW_CHANNEL_ID,
	DEMO_PREVIEW_DEFAULT_END_MS,
	DEMO_PREVIEW_DEFAULT_START_MS,
} from "../services/preview/demo-preview.fixture.ts";
import type { StorageProvider } from "../services/storage/storage.types.ts";
import { previewRouter } from "./preview.routes.ts";

const fixturesDir = path.join(
	import.meta.dirname,
	"../services/sources/__fixtures__/hls-preview",
);
const sampleMpd = readFileSync(path.join(fixturesDir, "sample.mpd"), "utf-8");
const playResponse = JSON.parse(
	readFileSync(path.join(fixturesDir, "sample-play-response.json"), "utf-8"),
) as { segmentStartTimeMs: number };

const SEG_START_MS = playResponse.segmentStartTimeMs;
const START_MS = SEG_START_MS + 6333;
const END_MS = SEG_START_MS + 25000;

// ---------------------------------------------------------------------------
// In-memory storage mock
// ---------------------------------------------------------------------------
class MemoryStorage implements StorageProvider {
	store = new Map<string, string>();

	async uploadStream(stream: Readable, key: string): Promise<void> {
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		this.store.set(key, Buffer.concat(chunks).toString("utf-8"));
	}

	async downloadToFile(): Promise<void> {
		throw new Error("not implemented");
	}

	async getPresignedUrl(key: string): Promise<string> {
		return `https://s3.example.com/${key}?sig=mock`;
	}

	async getPresignedUploadUrl(key: string): Promise<string> {
		return `https://s3.example.com/${key}?upload=mock`;
	}

	async deleteFile(): Promise<void> {}
	async ensureBucketExists(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Test config
// ---------------------------------------------------------------------------
const baseConfig: EnvConfig = {
	PORT: 4001,
	HOST: "127.0.0.1",
	MIN_TRANSCODE_SEGMENT_SECONDS: 0.35,
	FFMPEG_PRESET: "veryfast",
	FFMPEG_CRF: "20",
	FFMPEG_AUDIO_BITRATE: "192k",
	CHANNEL_PLAY_API_BASE_URL: "",
	SERVER_BASE_URL: "http://localhost:4001",
	MAX_PREVIEW_DURATION_MS: 3600000,
	PREVIEW_JOB_TTL_SECONDS: 86400,
	S3_PREVIEW_PREFIX: "preview",
	ENABLE_MPD_RESTRICTIONS: false,
	TRANSCODE_TIMEOUT_MS: 7200000,
	MAX_TEMP_FILE_SIZE_MB: 5000,
	MPD_TRANSCODE_CRF_MULTI: "10",
	MPD_TRANSCODE_CRF_SINGLE: "18",
	MPD_TRANSCODE_PRESET: "medium",
	S3_BUCKET: "test",
	S3_REGION: "us-east-1",
	S3_ENDPOINT: "http://localhost:9000",
	S3_FORCE_PATH_STYLE: true,
	S3_ACCESS_KEY_ID: "test",
	S3_SECRET_ACCESS_KEY: "test",
	S3_UPLOAD_PREFIX: "uploads",
	S3_OUTPUT_PREFIX: "output",
	S3_AUTO_CREATE_BUCKET: false,
	REDIS_HOST: "localhost",
	REDIS_PORT: 6379,
	REDIS_PASSWORD: "",
	JOB_PROGRESS_TTL_SECONDS: 600,
	RENDER_URL_EXPIRY_SECONDS: 86400,
};

function buildApp(configOverrides: Partial<EnvConfig> = {}) {
	const app = createFastifyInstance();
	const storage = new MemoryStorage();
	app.decorate("config", { ...baseConfig, ...configOverrides });
	app.decorate("storage", storage);
	app.register(previewRouter, { prefix: "/api" });
	return { app, storage };
}

// ---------------------------------------------------------------------------
// POST /api/editor/preview-source — inline MPD path
// ---------------------------------------------------------------------------
describe("POST /api/editor/preview-source — inline MPD (no channel API)", () => {
	let app: ReturnType<typeof buildApp>["app"];
	let storage: MemoryStorage;

	beforeEach(async () => {
		({ app, storage } = buildApp());
		await app.ready();
	});

	afterEach(async () => {
		await app.close();
	});

	it("returns 200 with HLS playlist URL for valid inline MPD request", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-1",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
				mpdXml: sampleMpd,
				mpdBaseUrl: "https://cdn.example.com/streams/ch-1",
				segmentStartTimeMs: SEG_START_MS,
			},
		});

		assert.equal(res.statusCode, 200);
		const body = res.json<{
			type: string;
			playlistUrl: string;
			channelId: string;
			durationMs: number;
			sourceOffsetMs: number;
		}>();
		assert.equal(body.type, "hls");
		assert.ok(
			body.playlistUrl.startsWith("https://s3.example.com/preview/"),
			"playlistUrl must be presigned S3 URL",
		);
		assert.equal(body.channelId, "ch-1");
		assert.equal(body.durationMs, END_MS - START_MS);
		assert.ok(body.sourceOffsetMs >= 0);
	});

	it("stores valid HLS playlist in S3", async () => {
		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-1",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
				mpdXml: sampleMpd,
				mpdBaseUrl: "https://cdn.example.com/streams/ch-1",
				segmentStartTimeMs: SEG_START_MS,
			},
		});

		const [, playlist] = [...storage.store.entries()][0];
		assert.ok(playlist.startsWith("#EXTM3U"), "stored content must be HLS");
		assert.ok(playlist.includes("#EXT-X-ENDLIST"), "must be VOD playlist");
		assert.ok(
			playlist.includes("https://cdn.example.com/streams/ch-1/"),
			"segments must have absolute URLs",
		);
	});

	it("inline MPD without vodToken does not rewrite segments to proxy", async () => {
		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-1",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
				mpdXml: sampleMpd,
				mpdBaseUrl: "https://cdn.example.com/streams/ch-1",
				segmentStartTimeMs: SEG_START_MS,
			},
		});

		const [, playlist] = [...storage.store.entries()][0];
		assert.ok(
			!playlist.includes("/api/editor/segment"),
			"inline MPD path must not proxy segments",
		);
	});

	it("returns 400 when endTimeMs <= startTimeMs", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-1",
					startTimeMs: 2000,
					endTimeMs: 2000,
				},
				mpdXml: sampleMpd,
				mpdBaseUrl: "https://cdn.example.com/streams/ch-1",
				segmentStartTimeMs: SEG_START_MS,
			},
		});
		assert.equal(res.statusCode, 400);
	});

	it("returns 400 when duration exceeds MAX_PREVIEW_DURATION_MS", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-1",
					startTimeMs: 0,
					endTimeMs: 999_999_999,
				},
				mpdXml: sampleMpd,
				mpdBaseUrl: "https://cdn.example.com/streams/ch-1",
				segmentStartTimeMs: SEG_START_MS,
			},
		});
		assert.equal(res.statusCode, 400);
		assert.ok(res.json<{ error: string }>().error.includes("maximum"));
	});

	it("returns 501 when no channel API configured and no inline MPD", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-1",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});
		assert.equal(res.statusCode, 501);
	});

	it("returns 200 for the built-in demo recording fixture", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: DEMO_PREVIEW_CHANNEL_ID,
					startTimeMs: DEMO_PREVIEW_DEFAULT_START_MS,
					endTimeMs: DEMO_PREVIEW_DEFAULT_END_MS,
				},
			},
		});

		assert.equal(res.statusCode, 200);
		const body = res.json<{ playlistUrl: string; sourceOffsetMs: number }>();
		assert.ok(body.playlistUrl.startsWith("https://s3.example.com/preview/"));
		assert.equal(body.sourceOffsetMs, 0);
	});

	it("serves demo DASH assets locally", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/editor/demo-assets/stream.mpd",
		});

		assert.equal(res.statusCode, 200);
		assert.match(res.headers["content-type"] ?? "", /application\/dash\+xml/);
		assert.ok(res.body.includes("<MPD"), "demo MPD must be returned");
	});
});

// ---------------------------------------------------------------------------
// POST /api/editor/preview-source — channel API path (mocked fetch)
// ---------------------------------------------------------------------------
describe("POST /api/editor/preview-source — channel API (mocked fetch)", () => {
	let app: ReturnType<typeof buildApp>["app"];
	let storage: MemoryStorage;

	const MOCK_TOKEN = "vod-token-xyz";
	const CHANNEL_BASE = "https://play.example.com/v1";

	beforeEach(async () => {
		({ app, storage } = buildApp({
			CHANNEL_PLAY_API_BASE_URL: CHANNEL_BASE,
			SERVER_BASE_URL: "http://localhost:4001",
		}));

		mock.method(
			globalThis,
			"fetch",
			async (url: string | URL | Request): Promise<Response> => {
				const urlStr = url.toString();

				// play API
				if (urlStr.includes("/channels/") && urlStr.includes("/play")) {
					return new Response(
						JSON.stringify({
							url: "/streams/mock-recording/manifest.mpd",
							timeRange: [[SEG_START_MS, SEG_START_MS + 30000]],
							token: MOCK_TOKEN,
						}),
						{
							status: 200,
							headers: { "content-type": "application/json" },
						},
					);
				}

				// generate endpoint
				if (urlStr.includes("/streams/mock-recording/manifest.mpd")) {
					return new Response(sampleMpd, {
						status: 200,
						headers: { "content-type": "application/dash+xml" },
					});
				}

				throw new Error(`Unexpected fetch call: ${urlStr}`);
			},
		);

		await app.ready();
	});

	afterEach(async () => {
		mock.restoreAll();
		await app.close();
	});

	it("returns 200 and HLS playlist URL", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-42",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});

		assert.equal(res.statusCode, 200);
		const body = res.json<{ type: string; playlistUrl: string }>();
		assert.equal(body.type, "hls");
		assert.ok(body.playlistUrl.startsWith("https://s3.example.com/preview/"));
	});

	it("rewrites segment lines to proxy URLs", async () => {
		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-42",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});

		const [, playlist] = [...storage.store.entries()][0];
		const segmentLines = playlist
			.split("\n")
			.filter((l) => l.startsWith("http://localhost:4001/api/editor/segment"));

		assert.ok(segmentLines.length > 0, "must have proxy segment lines");
		assert.ok(
			segmentLines.every((l) => l.includes("token=")),
			"proxy URLs must include token",
		);
		assert.ok(
			segmentLines.every((l) => l.includes("url=")),
			"proxy URLs must include encoded url",
		);
	});

	it("rewrites EXT-X-MAP init segment to proxy URL", async () => {
		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-42",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});

		const [, playlist] = [...storage.store.entries()][0];
		const mapLine = playlist
			.split("\n")
			.find((l) => l.startsWith("#EXT-X-MAP"));
		assert.ok(mapLine, "#EXT-X-MAP must exist");
		assert.ok(
			mapLine?.includes("/api/editor/segment"),
			"init segment must be proxied",
		);
	});

	it("embeds the correct vod-token in proxy URLs", async () => {
		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-42",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});

		const [, playlist] = [...storage.store.entries()][0];
		assert.ok(
			playlist.includes(encodeURIComponent(MOCK_TOKEN)),
			"proxy URLs must embed the vod-token",
		);
	});

	it("uses timeRange[0][0] as segmentStartTimeMs (segment 426 in proxy URLs)", async () => {
		// Proxy URLs encode the original segment URL as base64url.
		// Decode each proxy line to verify segment_v2_426 is present.
		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-42",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});

		const [, playlist] = [...storage.store.entries()][0];
		const decodedSegments = playlist
			.split("\n")
			.filter((l) => l.includes("/api/editor/segment") && l.includes("url="))
			.map((l) => {
				const match = l.match(/url=([^&]+)/);
				return match
					? Buffer.from(match[1], "base64url").toString("utf-8")
					: "";
			});

		assert.ok(
			decodedSegments.some((s) => s.includes("segment_v2_426")),
			"decoded proxy URLs must include segment 426",
		);
	});

	it("sends vod-token header when fetching the generate (MPD) endpoint", async () => {
		let capturedVodToken: string | undefined;

		// Override the fetch mock to capture the header on the generate call
		mock.method(
			globalThis,
			"fetch",
			async (
				_url: string | URL | Request,
				init?: RequestInit,
			): Promise<Response> => {
				const urlStr = _url.toString();

				if (urlStr.includes("/channels/") && urlStr.includes("/play")) {
					return new Response(
						JSON.stringify({
							url: "/streams/mock-recording/manifest.mpd",
							timeRange: [[SEG_START_MS, SEG_START_MS + 30000]],
							token: MOCK_TOKEN,
						}),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				}

				if (urlStr.includes("/streams/mock-recording/manifest.mpd")) {
					capturedVodToken = (
						init?.headers as Record<string, string> | undefined
					)?.["vod-token"];
					return new Response(sampleMpd, {
						status: 200,
						headers: { "content-type": "application/dash+xml" },
					});
				}

				throw new Error(`Unexpected fetch call: ${urlStr}`);
			},
		);

		await app.inject({
			method: "POST",
			url: "/api/editor/preview-source",
			payload: {
				source: {
					type: "channel-range",
					channelId: "ch-42",
					startTimeMs: START_MS,
					endTimeMs: END_MS,
				},
			},
		});

		assert.equal(
			capturedVodToken,
			MOCK_TOKEN,
			"generate endpoint must receive vod-token header with the token from the play response",
		);
	});
});

// ---------------------------------------------------------------------------
// GET /api/editor/segment — proxy route
// ---------------------------------------------------------------------------
describe("GET /api/editor/segment — proxy route", () => {
	let app: ReturnType<typeof buildApp>["app"];

	beforeEach(async () => {
		({ app } = buildApp());
		await app.ready();
	});

	afterEach(async () => {
		mock.restoreAll();
		await app.close();
	});

	it("proxies segment and adds vod-token header", async () => {
		const segmentUrl = "https://cdn.example.com/streams/segment_v2_426.m4s";
		const encoded = Buffer.from(segmentUrl, "utf8").toString("base64url");
		const token = "test-vod-token";

		const capturedHeaders: Record<string, string> = {};
		mock.method(
			globalThis,
			"fetch",
			async (
				_url: string | URL | Request,
				init?: RequestInit,
			): Promise<Response> => {
				capturedHeaders["vod-token"] =
					(init?.headers as Record<string, string>)?.["vod-token"] ?? "";
				return new Response(Buffer.from("fake-mp4-segment"), {
					status: 200,
					headers: { "content-type": "video/mp4" },
				});
			},
		);

		const res = await app.inject({
			method: "GET",
			url: `/api/editor/segment?url=${encoded}&token=${encodeURIComponent(token)}`,
		});

		assert.equal(res.statusCode, 200);
		assert.equal(capturedHeaders["vod-token"], token);
		assert.equal(res.headers["content-type"], "video/mp4");
	});

	it("returns 400 when url param is missing", async () => {
		const res = await app.inject({
			method: "GET",
			url: "/api/editor/segment?token=abc",
		});
		assert.equal(res.statusCode, 400);
	});

	it("returns 400 when token param is missing", async () => {
		const encoded = Buffer.from(
			"https://cdn.example.com/seg.m4s",
			"utf8",
		).toString("base64url");
		const res = await app.inject({
			method: "GET",
			url: `/api/editor/segment?url=${encoded}`,
		});
		assert.equal(res.statusCode, 400);
	});

	it("returns 400 for non-http protocol in decoded URL", async () => {
		const encoded = Buffer.from("file:///etc/passwd", "utf8").toString(
			"base64url",
		);
		const res = await app.inject({
			method: "GET",
			url: `/api/editor/segment?url=${encoded}&token=tok`,
		});
		assert.equal(res.statusCode, 400);
	});

	it("forwards upstream error status", async () => {
		const segmentUrl = "https://cdn.example.com/streams/missing.m4s";
		const encoded = Buffer.from(segmentUrl, "utf8").toString("base64url");

		mock.method(
			globalThis,
			"fetch",
			async (): Promise<Response> => new Response(null, { status: 403 }),
		);

		const res = await app.inject({
			method: "GET",
			url: `/api/editor/segment?url=${encoded}&token=tok`,
		});
		assert.equal(res.statusCode, 403);
	});
});
