import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RenderRequest } from "../edit-video/edit-video.types.ts";
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
import {
	type IDesign,
	transformDesignToRenderRequest,
} from "./design-transform.ts";

interface RenderJobState {
	status: "PROCESSING" | "COMPLETED" | "FAILED";
	progress: number;
	url?: string;
	error?: string;
}

interface StartRenderBody {
	design: IDesign;
	options?: {
		fps?: number;
		format?: string;
		size?: unknown;
		frameTimeMs?: number;
	};
}

interface StatusQuery {
	id?: string;
	type?: string;
}

interface RenderHandlerType {
	startRender: (
		req: FastifyRequest,
		reply: FastifyReply,
	) => Promise<FastifyReply>;
	getRenderStatus: (
		req: FastifyRequest,
		reply: FastifyReply,
	) => Promise<FastifyReply>;
}

const JOB_KEY = (jobId: string): string => `render:job:${jobId}`;
const JOB_TTL = 3600;

export const getRequestedFormat = (
	format?: string,
): RenderRequest["format"] => (format === "webp" ? "webp" : "mp4");

export const getRequestedFrameTimeMs = (
	frameTimeMs?: number,
): number | undefined =>
	typeof frameTimeMs === "number" && Number.isFinite(frameTimeMs)
		? frameTimeMs
		: undefined;

export const RenderHandler = (fastify: FastifyInstance): RenderHandlerType => {
	const saveJobState = async (
		jobId: string,
		state: RenderJobState,
	): Promise<void> => {
		try {
			await fastify.redis.set(
				JOB_KEY(jobId),
				JSON.stringify(state),
				"EX",
				JOB_TTL,
			);
		} catch (err) {
			fastify.log.error(err, `Failed to save render job state: ${jobId}`);
		}
	};

	const runRender = async (
		jobId: string,
		request: RenderRequest,
	): Promise<void> => {
		const storage = fastify.storage;
		const config = fastify.config;

		try {
			const tempDir = await createTempDir("render-job-");
			const keepSegments = calculateKeepSegments(request);

			if (keepSegments.length === 0) {
				throw new Error("No video content would remain after trimming/cuts");
			}

			const totalDurationSegments =
				calculateTotalDurationSegments(keepSegments);
			const sourcePath = await processSources(
				request.sources,
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
				request.overlays,
				tempDir,
				storage,
				config,
			);
			const { audioPaths, hasAudio } = await prepareAudioSources(
				request.audioSources || [],
				tempDir,
				totalDurationSegments,
				storage,
			);

			const filename = `${Date.now()}.${request.format}`;
			const s3Key = `${config.S3_OUTPUT_PREFIX}/${filename}`;

			const result = await finalRenderToS3(
				segmentPaths,
				overlayInputs,
				request.overlays,
				keepSegments,
				totalDurationSegments,
				hasOverlays,
				request.sources,
				tempDir,
				request.format,
				audioPaths,
				hasAudio,
				request.audioMixMode || "mix",
				request.frameTimeMs,
				s3Key,
				storage,
				config,
				86400,
				async (p: number) => {
					await saveJobState(jobId, { status: "PROCESSING", progress: p });
				},
				request.cropRegion,
			);

			await saveJobState(jobId, {
				status: "COMPLETED",
				progress: 100,
				url: result.url,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Render failed";
			await saveJobState(jobId, {
				status: "FAILED",
				progress: 0,
				error: message,
			});
			fastify.log.error(err, `Render job ${jobId} failed`);
		}
	};

	return {
		startRender: async (
			req: FastifyRequest,
			reply: FastifyReply,
		): Promise<FastifyReply> => {
			const body = req.body as StartRenderBody;

			if (!body?.design) {
				return reply.status(400).send({ error: "design is required" });
			}

			const jobId = randomUUID();
			const format = getRequestedFormat(body.options?.format);
			const frameTimeMs = getRequestedFrameTimeMs(body.options?.frameTimeMs);

			const renderRequest: RenderRequest = {
				...transformDesignToRenderRequest(body.design, format),
				jobId,
				frameTimeMs,
			};

			await saveJobState(jobId, { status: "PROCESSING", progress: 0 });

			// Fire-and-forget
			void runRender(jobId, renderRequest);

			return reply.status(202).send({ id: jobId });
		},

		getRenderStatus: async (
			req: FastifyRequest,
			reply: FastifyReply,
		): Promise<FastifyReply> => {
			const { id: jobId } = req.query as StatusQuery;

			if (!jobId) {
				return reply.status(400).send({ error: "id query param is required" });
			}

			try {
				const raw = await fastify.redis.get(JOB_KEY(jobId));
				if (!raw) {
					return reply.status(404).send({ error: "Job not found" });
				}

				const state = JSON.parse(raw) as RenderJobState;
				return reply.send({
					status: state.status,
					progress: state.progress,
					url: state.url,
					error: state.error,
					// Alias for frontend compatibility
					presigned_url: state.url,
				});
			} catch (err) {
				fastify.log.error(err, `Failed to get render status: ${jobId}`);
				return reply
					.status(500)
					.send({ error: "Failed to retrieve job status" });
			}
		},
	};
};
