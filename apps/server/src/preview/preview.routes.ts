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

interface ChannelPlayResponse {
	mpdXml: string;
	baseUrl: string;
	segmentStartTimeMs: number;
}

async function fetchChannelPlayResponse(
	channelPlayApiBaseUrl: string,
	channelId: string,
	startTimeMs: number,
	endTimeMs: number,
): Promise<ChannelPlayResponse> {
	const url = `${channelPlayApiBaseUrl}/channels/${channelId}/play?start=${startTimeMs}&end=${endTimeMs}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Channel play API returned ${response.status} for channel ${channelId}`,
		);
	}
	const data = (await response.json()) as ChannelPlayResponse;
	return data;
}

export const previewRouter: FastifyPluginAsync = async (
	fastify,
): Promise<void> => {
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
			} else {
				return reply.status(501).send({
					error:
						"CHANNEL_PLAY_API_BASE_URL is not configured. Provide mpdXml/mpdBaseUrl/segmentStartTimeMs in the request body for local testing.",
				});
			}

			const { playlist, sourceOffsetMs } = generateHlsPlaylist({
				mpdXml,
				baseUrl,
				segmentStartTimeMs: segStartMs,
				requestedStartMs: startTimeMs,
				requestedEndMs: endTimeMs,
				maxDurationMs: config.MAX_PREVIEW_DURATION_MS,
			});

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
