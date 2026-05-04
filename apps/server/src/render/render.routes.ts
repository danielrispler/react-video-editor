import type { FastifyInstance } from "fastify";
import { RenderHandler } from "./render.handler.ts";

export const renderRouter = (fastify: FastifyInstance): void => {
	const handler = RenderHandler(fastify);
	fastify.post("/render", handler.startRender);
	fastify.get("/render", handler.getRenderStatus);
};
