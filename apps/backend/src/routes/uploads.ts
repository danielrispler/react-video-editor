import type { FastifyPluginAsync } from "fastify";
import {
	uploadBufferToStorage,
	createPresignedUpload,
} from "../lib/storage.ts";

interface PresignBody {
	userId: string;
	fileNames: string[];
	contentTypes?: string[];
}

export const uploadsRoutes: FastifyPluginAsync = async (app) => {
	app.post("/file", async (request, reply) => {
		try {
			const parts = request.parts();
			let userId: string | undefined;
			let fileBuffer: Buffer | undefined;
			let fileName: string | undefined;
			let contentType: string | undefined;

			for await (const part of parts) {
				if (part.type === "field" && part.fieldname === "userId") {
					userId = part.value as string;
				} else if (part.type === "file" && part.fieldname === "file") {
					fileName = part.filename;
					contentType = part.mimetype;
					const chunks: Buffer[] = [];
					for await (const chunk of part.file) {
						chunks.push(chunk);
					}
					fileBuffer = Buffer.concat(chunks);
				}
			}

			if (!userId) {
				return reply.status(400).send({ error: "userId is required" });
			}
			if (!fileBuffer || !fileName) {
				return reply.status(400).send({ error: "file is required" });
			}

			const uploaded = await uploadBufferToStorage({
				userId,
				fileName,
				contentType,
				body: fileBuffer,
			});

			return { success: true, upload: uploaded };
		} catch (error) {
			app.log.error({ err: error }, "Error in file upload route:");
			return reply.status(500).send({
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	app.post<{ Body: PresignBody }>("/presign", async (request, reply) => {
		try {
			const { userId, fileNames, contentTypes } = request.body;

			if (!userId) {
				return reply.status(400).send({ error: "userId is required" });
			}
			if (!Array.isArray(fileNames) || fileNames.length === 0) {
				return reply
					.status(400)
					.send({ error: "fileNames array is required and must not be empty" });
			}

			const uploads = await Promise.all(
				fileNames.map((fileName, index) =>
					createPresignedUpload({
						userId,
						fileName,
						contentType: contentTypes?.[index],
					}),
				),
			);

			return { success: true, uploads };
		} catch (error) {
			app.log.error({ err: error }, "Error in presign route:");
			return reply.status(500).send({
				error: "Internal server error",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});
};
