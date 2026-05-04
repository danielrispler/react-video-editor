import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Request } from "../fastify/fastify.ts";
import type { StorageProvider } from "../services/storage/storage.types.ts";
import { ALLOWED_MIMES } from "./upload.consts.ts";
import type { CleanupRequest, GetSignedUrlRequest } from "./upload.schema.ts";

export interface UploadHandler {
	getSignedUrl: (
		request: Request<GetSignedUrlRequest>,
		reply: FastifyReply,
	) => Promise<FastifyReply>;
	cleanup: (
		request: Request<CleanupRequest>,
		reply: FastifyReply,
	) => Promise<FastifyReply>;
	uploadFile: (
		request: FastifyRequest,
		reply: FastifyReply,
	) => Promise<FastifyReply>;
}

export const UploadHandler = (
	storage: StorageProvider,
	uploadPrefix: string,
): UploadHandler => {
	return {
		getSignedUrl: async (
			request: Request<GetSignedUrlRequest>,
			reply: FastifyReply,
		) => {
			console.log(
				"[getSignedUrl] Handler entered, body:",
				JSON.stringify(request.body),
			);
			const { filename, mimetype } = request.body;

			const ext = path.extname(filename).toLowerCase();
			const isMpd = ext === ".mpd";

			if (!ALLOWED_MIMES.includes(mimetype) && !isMpd) {
				return reply.status(StatusCodes.BAD_REQUEST).send({
					error: `File type not allowed: ${mimetype}. Allowed types: ${ALLOWED_MIMES.join(", ")}`,
				});
			}

			const generatedFilename = `${randomUUID()}${ext}`;
			const s3Key = `${uploadPrefix}/${generatedFilename}`;

			try {
				const uploadUrl = await storage.getPresignedUploadUrl(s3Key, mimetype);
				const publicUrl = await storage.getPresignedUrl(s3Key);

				const responseData = {
					uploadUrl,
					s3Key,
					filename: generatedFilename,
					publicUrl,
				};
				console.log(
					"[getSignedUrl] Responding with:",
					JSON.stringify(responseData),
				);
				return reply.status(StatusCodes.OK).send(responseData);
			} catch (err) {
				console.error("[getSignedUrl] Error:", err);
				return reply.status(500).send({
					error: err instanceof Error ? err.message : "Unknown error",
				});
			}
		},
		cleanup: async (request: Request<CleanupRequest>, reply: FastifyReply) => {
			const { s3Keys } = request.body;

			if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
				return reply.status(400).send({ error: "s3Keys array is required" });
			}

			const deletedFiles: string[] = [];
			const errors: string[] = [];

			for (const s3Key of s3Keys) {
				try {
					await storage.deleteFile(s3Key);
					deletedFiles.push(s3Key);
				} catch (err) {
					errors.push(
						`Failed to delete S3 file ${s3Key}: ${err instanceof Error ? err.message : "Unknown error"}`,
					);
				}
			}

			return reply.status(200).send({
				deleted: deletedFiles.length,
				deletedFiles,
				errors: errors.length > 0 ? errors : undefined,
			});
		},
		uploadFile: async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const parts = request.parts();
				let fileName: string | undefined;
				let contentType: string | undefined;
				let uploadedKey: string | undefined;

				for await (const part of parts) {
					if (part.type === "file" && part.fieldname === "file") {
						fileName = part.filename;
						contentType = part.mimetype;

						const ext = path.extname(fileName).toLowerCase();
						const generatedName = `${randomUUID()}${ext}`;
						uploadedKey = `${uploadPrefix}/${generatedName}`;

						await storage.uploadStream(part.file, uploadedKey, contentType);
					} else if (part.type === "field") {
						void part.value;
					}
				}

				if (!uploadedKey || !fileName || !contentType) {
					return reply.status(400).send({ error: "file field is required" });
				}

				const url = await storage.getPresignedUrl(uploadedKey);

				return reply.status(200).send({
					success: true,
					upload: {
						fileName,
						filePath: uploadedKey,
						contentType,
						url,
						folder: null,
					},
				});
			} catch (err) {
				console.error("[uploadFile] Error:", err);
				return reply.status(500).send({
					error: err instanceof Error ? err.message : "Unknown error",
				});
			}
		},
	};
};
