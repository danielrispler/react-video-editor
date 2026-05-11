import type { VideoRenderUseCase } from "../../../video-render/application/use-cases/VideoRenderUseCase.ts";

export interface EditorExportInput {
	sourceUrl: string;
	sourceDuration: number;
	trimFrom?: number;
	trimTo?: number;
	cuts?: { start: number; end: number }[];
	format: "mp4" | "dash";
	s3Key: string;
}

export interface EditorExportOutput {
	url: string;
	s3Key: string;
	format: "mp4" | "dash";
}

export class EditorExportUseCase {
	private readonly videoRender: VideoRenderUseCase;

	constructor(videoRender: VideoRenderUseCase) {
		this.videoRender = videoRender;
	}

	async execute(input: EditorExportInput): Promise<EditorExportOutput> {
		const {
			sourceUrl,
			sourceDuration,
			trimFrom,
			trimTo,
			cuts = [],
			format,
			s3Key,
		} = input;

		const sources = [
			{
				url: sourceUrl,
				type: "video" as const,
				duration: sourceDuration,
				trimFrom,
				trimTo,
			},
		];
		const trimEnd = trimTo ?? sourceDuration;

		const result = await this.videoRender.execute(
			{
				sources,
				trimEnd,
				cuts,
				overlays: [],
				audioSources: [],
				audioMixMode: "mix",
				format,
			},
			s3Key,
		);

		return { url: result.url, s3Key: result.s3Key, format };
	}
}
