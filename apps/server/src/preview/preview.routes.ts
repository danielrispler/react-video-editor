import type { FastifyPluginAsync } from "fastify";
import { generateHlsPlaylist } from "../services/preview/mpd-to-hls.service.ts";
import { storePreviewPlaylist } from "../services/preview/preview-job.service.ts";

interface ChannelRangeSource {
	type: "channel-range";
	channelId: string;
	startTimeMs: number;
	endTimeMs: number;
}

interface PreviewSourceBody {
	source: ChannelRangeSource;
	/** Optional raw MPD XML — used as testing fallback when CHANNEL_PLAY_API_BASE_URL is unset. */
	mpdXml?: string;
	/** Optional base URL for the MPD segments — used alongside mpdXml for testing. */
	mpdBaseUrl?: string;
	/** Absolute wall-clock timestamp (ms) of the first segment (startNumber). Required with mpdXml. */
	segmentStartTimeMs?: number;
}

interface PreviewSourceResponse {
	type: "hls";
	playlistUrl: string;
	channelId: string;
	requestedStartMs: number;
	requestedEndMs: number;
	durationMs: number;
	sourceOffsetMs: number;
}

interface ChannelPlayApiResponse {
	url: string;
	timeRange: number[][];
	token: string;
}

async function fetchChannelPlayResponse(
	channelPlayApiBaseUrl: string,
	channelId: string,
	startTimeMs: number,
	endTimeMs: number,
): Promise<{
	mpdXml: string;
	baseUrl: string;
	segmentStartTimeMs: number;
	token: string;
}> {
	const playUrl = `${channelPlayApiBaseUrl}/channels/${channelId}/play?start=${startTimeMs}&end=${endTimeMs}`;
	const playRes = await fetch(playUrl);
	if (!playRes.ok) {
		throw new Error(
			`Channel play API returned ${playRes.status} for channel ${channelId}`,
		);
	}
	const play = (await playRes.json()) as ChannelPlayApiResponse;

	const origin = new URL(channelPlayApiBaseUrl).origin;
	const relativePath = play.url.startsWith("/") ? play.url : `/${play.url}`;
	const generateUrl = `${origin}${relativePath}`;
	const genRes = await fetch(generateUrl, {
		headers: { "vod-token": play.token },
	});
	if (!genRes.ok) {
		throw new Error(`Generate API returned ${genRes.status}`);
	}
	const mpdXml = await genRes.text();

	const segmentStartTimeMs = play.timeRange[0][0];
	return { mpdXml, baseUrl: origin, segmentStartTimeMs, token: play.token };
}

function rewritePlaylistToProxy(
	playlist: string,
	token: string,
	proxyBase: string,
): string {
	return playlist
		.split("\n")
		.map((line) => {
			if (line.startsWith("http://") || line.startsWith("https://")) {
				const encoded = Buffer.from(line, "utf8").toString("base64url");
				return `${proxyBase}?url=${encoded}&token=${encodeURIComponent(token)}`;
			}
			// Rewrite EXT-X-MAP URI if it contains an absolute URL
			const mapMatch = line.match(/^#EXT-X-MAP:URI="(https?:\/\/[^"]+)"$/);
			if (mapMatch) {
				const encoded = Buffer.from(mapMatch[1], "utf8").toString("base64url");
				return `#EXT-X-MAP:URI="${proxyBase}?url=${encoded}&token=${encodeURIComponent(token)}"`;
			}
			return line;
		})
		.join("\n");
}

export const previewRouter: FastifyPluginAsync = async (
	fastify,
): Promise<void> => {
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
			const config = fastify.config;
			const storage = fastify.storage;

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

			let mpdXml: string;
			let baseUrl: string;
			let segStartMs: number;
			let vodToken: string | undefined;

			if (rawMpdXml && mpdBaseUrl && segmentStartTimeMs !== undefined) {
				// Testing fallback: caller provided MPD directly
				mpdXml = rawMpdXml;
				baseUrl = mpdBaseUrl;
				segStartMs = segmentStartTimeMs;
			} else if (config.CHANNEL_PLAY_API_BASE_URL) {
				const playResponse = await fetchChannelPlayResponse(
					config.CHANNEL_PLAY_API_BASE_URL,
					channelId,
					startTimeMs,
					endTimeMs,
				);
				mpdXml = playResponse.mpdXml;
				baseUrl = playResponse.baseUrl;
				segStartMs = playResponse.segmentStartTimeMs;
				vodToken = playResponse.token;
			} else {
				return reply.status(501).send({
					error:
						"CHANNEL_PLAY_API_BASE_URL is not configured. Provide mpdXml/mpdBaseUrl/segmentStartTimeMs in the request body for local testing.",
				});
			}

			const { playlist: rawPlaylist, sourceOffsetMs } = generateHlsPlaylist({
				mpdXml,
				baseUrl,
				segmentStartTimeMs: segStartMs,
				requestedStartMs: startTimeMs,
				requestedEndMs: endTimeMs,
				maxDurationMs: config.MAX_PREVIEW_DURATION_MS,
			});

			const playlist =
				vodToken !== undefined
					? rewritePlaylistToProxy(
							rawPlaylist,
							vodToken,
							`${config.SERVER_BASE_URL}/api/editor/segment`,
						)
					: rawPlaylist;

			const { playlistUrl } = await storePreviewPlaylist(
				playlist,
				config.S3_PREVIEW_PREFIX,
				storage,
				config.PREVIEW_JOB_TTL_SECONDS,
			);

			const responseBody: PreviewSourceResponse = {
				type: "hls",
				playlistUrl,
				channelId,
				requestedStartMs: startTimeMs,
				requestedEndMs: endTimeMs,
				durationMs,
				sourceOffsetMs,
			};

			return reply.status(200).send(responseBody);
		},
	);
};
