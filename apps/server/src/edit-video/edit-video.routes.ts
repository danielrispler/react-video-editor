import type { FastifyInstance } from "fastify";
import { EditVideoHandler } from "./edit-video.handler.ts";
import { editVideoRequestSchema } from "./edit-video.schema.ts";

export const editVideoRouter = (fastify: FastifyInstance): void => {
	const handler = EditVideoHandler();
	fastify.post(
		"/edit-video",
		{ schema: { body: editVideoRequestSchema } },
		handler.editVideo,
	);
	fastify.get("/edit-video/progress/:jobId", handler.getJobProgress);
};
