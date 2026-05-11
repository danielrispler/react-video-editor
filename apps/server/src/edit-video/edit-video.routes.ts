import type { FastifyInstance } from "fastify";
import { RedisJobProgressAdapter } from "../video-render/adapters/outbound/redis/RedisJobProgressAdapter.ts";
import { VideoRenderUseCase } from "../video-render/application/use-cases/VideoRenderUseCase.ts";
import { EditVideoHandler } from "./edit-video.handler.ts";
import { editVideoRequestSchema } from "./edit-video.schema.ts";

export const editVideoRouter = (fastify: FastifyInstance): void => {
	const videoRenderUseCase = new VideoRenderUseCase(
		fastify.storage,
		fastify.config,
	);
	const jobProgressPort = new RedisJobProgressAdapter(
		fastify.redis,
		fastify.config.JOB_PROGRESS_TTL_SECONDS,
	);
	const handler = EditVideoHandler(
		videoRenderUseCase,
		jobProgressPort,
		fastify.config.S3_OUTPUT_PREFIX,
	);

	fastify.post(
		"/edit-video",
		{ schema: { body: editVideoRequestSchema } },
		handler.editVideo,
	);
	fastify.get("/edit-video/progress/:jobId", handler.getJobProgress);
};
