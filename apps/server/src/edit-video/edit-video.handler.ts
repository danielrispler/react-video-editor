import type { Request } from "../fastify/fastify.ts";
import type { RenderResponse } from "../types/types.ts";
import { getOutputFilename } from "../utils/file.utils.ts";
import type { JobProgressPort } from "../video-render/application/ports/outbound/JobProgressPort.ts";
import type { VideoRenderUseCase } from "../video-render/application/use-cases/VideoRenderUseCase.ts";
import type { RenderRequest } from "./edit-video.types.ts";

interface EditVideoHandlerType {
	editVideo: (req: Request<RenderRequest>) => Promise<RenderResponse>;
	getJobProgress: (
		req: Request<unknown, unknown, { jobId: string }>,
	) => Promise<{ progress: number }>;
}

export const EditVideoHandler = (
	videoRenderUseCase: VideoRenderUseCase,
	jobProgressPort: JobProgressPort,
	s3OutputPrefix: string,
): EditVideoHandlerType => {
	return {
		editVideo: async (req: Request<RenderRequest>): Promise<RenderResponse> => {
			const { jobId, ...renderInput } = req.body;
			const s3Key = `${s3OutputPrefix}/${getOutputFilename(req.body.format)}`;

			await jobProgressPort.setProgress(jobId, 0);
			try {
				const result = await videoRenderUseCase.execute(
					renderInput,
					s3Key,
					async (p) => {
						await jobProgressPort.setProgress(jobId, p);
					},
				);
				await jobProgressPort.deleteProgress(jobId);
				return { jobId, outputFile: result.url, segments: result.segments };
			} catch (e) {
				await jobProgressPort.deleteProgress(jobId);
				throw e;
			}
		},

		getJobProgress: async (
			req: Request<unknown, unknown, { jobId: string }>,
		): Promise<{ progress: number }> => {
			const { jobId } = req.params;
			const progress = await jobProgressPort.getProgress(jobId);
			return { progress: progress ?? 0 };
		},
	};
};
