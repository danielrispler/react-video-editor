import type { FastifyPluginAsync } from "fastify";
import { UploadUseCase } from "./application/use-cases/UploadUseCase.ts";
import { UploadHandler } from "./upload.handler.ts";
import {
	cleanupRequestSchema,
	getSignedUrlRequestSchema,
} from "./upload.schema.ts";

export const uploadRouter: FastifyPluginAsync = async (
	fastify,
): Promise<void> => {
	const uploadUseCase = new UploadUseCase(
		fastify.storage,
		fastify.config.S3_UPLOAD_PREFIX,
	);
	const handler = UploadHandler(uploadUseCase);

	fastify.post(
		"/upload/signed-url",
		{ schema: getSignedUrlRequestSchema },
		handler.getSignedUrl,
	);
	fastify.post("/cleanup", { schema: cleanupRequestSchema }, handler.cleanup);
	fastify.post("/uploads/file", handler.uploadFile);
};
