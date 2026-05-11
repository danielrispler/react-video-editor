import type { FastifyInstance } from "fastify";
import { RedisRenderJobStateAdapter } from "../video-render/adapters/outbound/redis/RedisRenderJobStateAdapter.ts";
import { VideoRenderUseCase } from "../video-render/application/use-cases/VideoRenderUseCase.ts";
import { RenderHandler } from "./render.handler.ts";

export const renderRouter = (fastify: FastifyInstance): void => {
	const videoRenderUseCase = new VideoRenderUseCase(
		fastify.storage,
		fastify.config,
	);
	const renderJobStatePort = new RedisRenderJobStateAdapter(fastify.redis);
	const handler = RenderHandler(
		videoRenderUseCase,
		renderJobStatePort,
		fastify.config.S3_OUTPUT_PREFIX,
	);

	fastify.post("/render", handler.startRender);
	fastify.get("/render", handler.getRenderStatus);
};
