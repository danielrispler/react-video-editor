import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import {
	DashFallbackAdapter,
	type ExportHandoffAdapter,
} from "../services/export/export-handoff.adapter.ts";
import { prepareOverlays } from "../services/overlays/overlay.service.ts";
import { prepareAudioSources } from "../services/sources/audio-process.service.ts";
import { processSources } from "../services/sources/process-sources.service.ts";
import {
	extractSegments,
	finalRenderToS3,
} from "../services/video-processor.service.ts";
import { createTempDir } from "../utils/file.utils.ts";
import { calculateTotalDurationSegments } from "../utils/segment.utils.ts";
import { calculateKeepSegments } from "../utils/video.utils.ts";

interface CutRange {
	start: number;
	end: number;
}

interface ExportEdits {
	cuts?: CutRange[];
	overlays?: unknown[];
	audio?: unknown[];
}

interface ExportOutput {
	format?: "mp4" | "dash";
}

interface ChannelRangeSource {
	type: "channel-range";
	channelId: string;
	startTimeMs: number;
	endTimeMs: number;
}

interface DirectSource {
	type: "direct";
	url: string;
	duration: number;
	trimFrom?: number;
	trimTo?: number;
}

type ExportSource = ChannelRangeSource | DirectSource;

interface EditorExportBody {
	source: ExportSource;
	edits?: ExportEdits;
	output?: ExportOutput;
}

// Shared handoff adapter instance — swap for real ingestion service when available
const handoffAdapter: ExportHandoffAdapter = new DashFallbackAdapter();

export const editorExportRouter: FastifyPluginAsync = async (
	fastify,
): Promise<void> => {
	fastify.post<{ Body: EditorExportBody }>(
		"/editor/export",
		async (request, reply) => {
			const { source, edits = {}, output = {} } = request.body;
			const config = fastify.config;
			const storage = fastify.storage;
			const format = output.format ?? "mp4";

			const tempDir = await createTempDir("editor-export-");

			if (source.type === "channel-range") {
				// For channel-range, resolve via POST /api/editor/preview-source first to get HLS URL.
				return reply.status(400).send({
					error:
						"channel-range source requires a pre-resolved HLS src. Use POST /api/editor/preview-source first to get the HLS playlistUrl, then submit as a direct source.",
				});
			}

			const {
				url: sourceUrl,
				duration: sourceDuration,
				trimFrom,
				trimTo,
			} = source;

			const sources = [
				{
					url: sourceUrl,
					type: "video" as const,
					duration: sourceDuration,
					trimFrom,
					trimTo,
				},
			];

			const cuts: CutRange[] = edits.cuts ?? [];
			const trimEnd = trimTo ?? sourceDuration;
			const keepSegments = calculateKeepSegments({ sources, cuts, trimEnd });

			if (keepSegments.length === 0) {
				return reply
					.status(400)
					.send({ error: "No video content remains after cuts" });
			}

			const totalDuration = calculateTotalDurationSegments(keepSegments);
			const sourcePath = await processSources(
				sources,
				tempDir,
				storage,
				config,
			);
			const segmentPaths = await extractSegments(
				sourcePath,
				keepSegments,
				tempDir,
			);

			const { overlayInputs, hasOverlays } = await prepareOverlays(
				[],
				tempDir,
				storage,
				config,
			);
			const { audioPaths, hasAudio } = await prepareAudioSources(
				[],
				tempDir,
				totalDuration,
				storage,
			);

			const timestamp = Date.now();
			const s3KeyPrefix = `${config.S3_OUTPUT_PREFIX}/${timestamp}`;
			const s3KeyMp4 = `${s3KeyPrefix}/rendered.mp4`;

			if (format === "dash") {
				// Render to temp MP4, then hand off to adapter for DASH packaging + upload
				const renderedVideoPath = path.join(
					tempDir,
					`rendered-${timestamp}.mp4`,
				);

				await finalRenderToS3(
					segmentPaths,
					overlayInputs,
					[],
					keepSegments,
					totalDuration,
					hasOverlays,
					sources,
					tempDir,
					"mp4",
					audioPaths,
					hasAudio,
					"mix",
					undefined,
					s3KeyMp4,
					storage,
					config,
					86400,
				);

				const result = await handoffAdapter.handoff(renderedVideoPath, {
					s3KeyPrefix,
					tempDir,
					storage,
					config,
					expiresInSeconds: 86400,
				});

				return reply
					.status(200)
					.send({ url: result.url, s3Key: result.s3Key, format: "dash" });
			}

			const result = await finalRenderToS3(
				segmentPaths,
				overlayInputs,
				[],
				keepSegments,
				totalDuration,
				hasOverlays,
				sources,
				tempDir,
				"mp4",
				audioPaths,
				hasAudio,
				"mix",
				undefined,
				s3KeyMp4,
				storage,
				config,
				86400,
			);

			return reply
				.status(200)
				.send({ url: result.url, s3Key: result.s3Key, format: "mp4" });
		},
	);
};
