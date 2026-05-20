import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";
import type { Request } from "../fastify/fastify.ts";
import type { UploadUseCase } from "./application/use-cases/UploadUseCase.ts";
import { ALLOWED_EXTENSIONS, ALLOWED_MIMES } from "./upload.consts.ts";
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

const isAllowedUpload = (filename: string, mimetype?: string): boolean => {
	const ext = path.extname(filename).toLowerCase();
	const mimeAllowed = mimetype ? ALLOWED_MIMES.includes(mimetype) : false;
	const extAllowed = ALLOWED_EXTENSIONS.includes(ext);
	return mimeAllowed || extAllowed;
};

export const UploadHandler = (uploadUseCase: UploadUseCase): UploadHandler => {
	return {
		getSignedUrl: async (
			request: Request<GetSignedUrlRequest>,
			reply: FastifyReply,
		) => {
			const { filename, mimetype } = request.body;
			const ext = path.extname(filename).toLowerCase();

			if (!isAllowedUpload(filename, mimetype)) {
				return reply.status(StatusCodes.BAD_REQUEST).send({
					error: `File type not allowed: ${mimetype || ext}. Allowed types: ${ALLOWED_MIMES.join(", ")}`,
				});
			}

			try {
				const result = await uploadUseCase.getSignedUrl({ filename, mimetype });
				return reply.status(StatusCodes.OK).send(result);
			} catch (err) {
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

			const result = await uploadUseCase.deleteFiles({ s3Keys });
			return reply.status(200).send(result);
		},

		uploadFile: async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const parts = request.parts();
				let fileName: string | undefined;
				let contentType: string | undefined;
				let uploadResult:
					| Awaited<ReturnType<UploadUseCase["uploadFile"]>>
					| undefined;

				for await (const part of parts) {
					if (part.type === "file" && part.fieldname === "file") {
						fileName = part.filename;
						contentType = part.mimetype;

						if (!isAllowedUpload(fileName, contentType)) {
							return reply.status(StatusCodes.BAD_REQUEST).send({
								error: `File type not allowed: ${contentType || path.extname(fileName).toLowerCase()}. Allowed types: ${ALLOWED_MIMES.join(", ")}`,
							});
						}

						uploadResult = await uploadUseCase.uploadFile({
							filename: fileName,
							mimetype: contentType,
							stream: part.file,
						});
					} else if (part.type === "field") {
						void part.value;
					}
				}

				if (!fileName || !contentType) {
					return reply.status(400).send({ error: "file field is required" });
				}
				if (!uploadResult) {
					return reply
						.status(500)
						.send({ error: "Upload failed: no result returned" });
				}

				return reply.status(200).send({
					success: true,
					upload: { ...uploadResult, folder: null },
				});
			} catch (err) {
				return reply.status(500).send({
					error: err instanceof Error ? err.message : "Unknown error",
				});
			}
		},
	};
};
