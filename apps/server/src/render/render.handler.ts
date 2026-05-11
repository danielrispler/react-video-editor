import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RenderRequest } from "../edit-video/edit-video.types.ts";
import { getOutputFilename } from "../utils/file.utils.ts";
import type { RenderJobStatePort } from "../video-render/application/ports/outbound/RenderJobStatePort.ts";
import type { VideoRenderUseCase } from "../video-render/application/use-cases/VideoRenderUseCase.ts";
import {
	type IDesign,
	transformDesignToRenderRequest,
} from "./design-transform.ts";

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

export const getRequestedFormat = (
	format?: string,
): RenderRequest["format"] => {
	if (format === "webp") return "webp";
	if (format === "dash") return "dash";
	return "mp4";
};

export const getRequestedFrameTimeMs = (
	frameTimeMs?: number,
): number | undefined =>
	typeof frameTimeMs === "number" && Number.isFinite(frameTimeMs)
		? frameTimeMs
		: undefined;

export const RenderHandler = (
	videoRenderUseCase: VideoRenderUseCase,
	renderJobStatePort: RenderJobStatePort,
	s3OutputPrefix: string,
): RenderHandlerType => {
	const runRender = async (
		jobId: string,
		request: RenderRequest,
	): Promise<void> => {
		const { jobId: _jobId, ...renderInput } = request;
		const s3Key = `${s3OutputPrefix}/${getOutputFilename(request.format)}`;

		try {
			const result = await videoRenderUseCase.execute(
				renderInput,
				s3Key,
				async (p) => {
					await renderJobStatePort.saveState(jobId, {
						status: "PROCESSING",
						progress: p,
					});
				},
			);
			await renderJobStatePort.saveState(jobId, {
				status: "COMPLETED",
				progress: 100,
				url: result.url,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Render failed";
			await renderJobStatePort.saveState(jobId, {
				status: "FAILED",
				progress: 0,
				error: message,
			});
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

			await renderJobStatePort.saveState(jobId, {
				status: "PROCESSING",
				progress: 0,
			});

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

			const state = await renderJobStatePort.getState(jobId);
			if (!state) {
				return reply.status(404).send({ error: "Job not found" });
			}

			return reply.send({
				status: state.status,
				progress: state.progress,
				url: state.url,
				error: state.error,
				presigned_url: state.url,
			});
		},
	};
};
