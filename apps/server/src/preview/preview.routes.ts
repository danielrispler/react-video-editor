import { promises as fsp } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import {
	DEMO_PREVIEW_CHANNEL_ID,
	getDemoPreviewAssetsDir,
} from "../services/preview/demo-preview.fixture.ts";
import { DemoChannelPlayApiAdapter } from "./adapters/outbound/demo/DemoChannelPlayApiAdapter.ts";
import { HttpChannelPlayApiAdapter } from "./adapters/outbound/http/HttpChannelPlayApiAdapter.ts";
import type { ChannelPlayApiPort } from "./application/ports/outbound/ChannelPlayApiPort.ts";
import { GeneratePreviewUseCase } from "./application/use-cases/GeneratePreviewUseCase.ts";

interface ChannelRangeSource {
	type: "channel-range";
	channelId: string;
	startTimeMs: number;
	endTimeMs: number;
}

interface PreviewSourceBody {
	source: ChannelRangeSource;
	mpdXml?: string;
	mpdBaseUrl?: string;
	segmentStartTimeMs?: number;
}

export const previewRouter: FastifyPluginAsync = async (
	fastify,
): Promise<void> => {
	const config = fastify.config;
	const storage = fastify.storage;
	const generatePreviewUseCase = new GeneratePreviewUseCase(storage, config);

	fastify.get("/editor/demo-assets/:filename", async (request, reply) => {
		const { filename } = request.params as { filename?: string };
		if (!filename || path.basename(filename) !== filename) {
			return reply.status(400).send({ error: "Invalid demo asset filename" });
		}

		const filePath = path.join(getDemoPreviewAssetsDir(), filename);
		try {
			const body = await fsp.readFile(filePath);
			const extension = path.extname(filename).toLowerCase();
			const contentType =
				extension === ".mpd"
					? "application/dash+xml"
					: extension === ".m4s"
						? "video/iso.segment"
						: "video/mp4";
			reply.header("Content-Type", contentType);
			return reply.send(body);
		} catch {
			return reply.status(404).send({ error: "Demo asset not found" });
		}
	});

	fastify.get("/editor/segment", async (request, reply) => {
		const { url, token } = request.query as { url?: string; token?: string };
		if (!url || !token) {
			return reply.status(400).send({ error: "Missing url or token" });
		}

		let decoded: string;
		try {
			decoded = Buffer.from(url, "base64url").toString("utf8");
		} catch {
			return reply.status(400).send({ error: "Invalid url encoding" });
		}

		let parsed: URL;
		try {
			parsed = new URL(decoded);
		} catch {
			return reply.status(400).send({ error: "Invalid URL" });
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return reply.status(400).send({ error: "Invalid URL" });
		}

		const upstream = await fetch(decoded, { headers: { "vod-token": token } });
		if (!upstream.ok) {
			return reply.status(upstream.status).send();
		}

		reply.header(
			"Content-Type",
			upstream.headers.get("content-type") ?? "video/mp4",
		);
		return reply.send(upstream.body);
	});

	fastify.post<{ Body: PreviewSourceBody }>(
		"/editor/preview-source",
		async (request, reply) => {
			const {
				source,
				mpdXml: rawMpdXml,
				mpdBaseUrl,
				segmentStartTimeMs,
			} = request.body;

			if (source.type !== "channel-range") {
				return reply
					.status(400)
					.send({ error: "source.type must be channel-range" });
			}

			const { channelId, startTimeMs, endTimeMs } = source;

			if (endTimeMs <= startTimeMs) {
				return reply
					.status(400)
					.send({ error: "endTimeMs must be greater than startTimeMs" });
			}

			const durationMs = endTimeMs - startTimeMs;
			if (durationMs > config.MAX_PREVIEW_DURATION_MS) {
				return reply.status(400).send({
					error: `Requested duration exceeds maximum of ${config.MAX_PREVIEW_DURATION_MS}ms`,
				});
			}

			let channelPlayApi: ChannelPlayApiPort;

			if (rawMpdXml && mpdBaseUrl && segmentStartTimeMs !== undefined) {
				const mpdXml = rawMpdXml;
				const baseUrl = mpdBaseUrl;
				const segStartMs = segmentStartTimeMs;
				channelPlayApi = {
					fetchMpd: async () => ({
						mpdXml,
						baseUrl,
						segmentStartTimeMs: segStartMs,
					}),
				};
			} else if (channelId === DEMO_PREVIEW_CHANNEL_ID) {
				const demoAdapter = new DemoChannelPlayApiAdapter(
					config.SERVER_BASE_URL,
				);
				channelPlayApi = demoAdapter;
			} else if (config.CHANNEL_PLAY_API_BASE_URL) {
				channelPlayApi = new HttpChannelPlayApiAdapter(
					config.CHANNEL_PLAY_API_BASE_URL,
				);
			} else {
				return reply.status(501).send({
					error:
						"CHANNEL_PLAY_API_BASE_URL is not configured. Provide mpdXml/mpdBaseUrl/segmentStartTimeMs or use channelId demo-recording for local testing.",
				});
			}

			try {
				const result = await generatePreviewUseCase.execute({
					channelId,
					startTimeMs,
					endTimeMs,
					channelPlayApi,
				});

				return reply.status(200).send({ type: "hls", ...result });
			} catch (err) {
				if (err instanceof RangeError) {
					return reply.status(400).send({ error: err.message });
				}
				throw err;
			}
		},
	);
};
