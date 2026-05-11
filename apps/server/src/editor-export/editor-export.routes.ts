import type { FastifyPluginAsync } from "fastify";
import { VideoRenderUseCase } from "../video-render/application/use-cases/VideoRenderUseCase.ts";
import { EditorExportUseCase } from "./application/use-cases/EditorExportUseCase.ts";

interface CutRange {
	start: number;
	end: number;
}

interface ExportEdits {
	cuts?: CutRange[];
}

interface ExportOutput {
	format?: "mp4" | "dash";
}

interface ChannelRangeSource {
	type: "channel-range";
	channelId: string;
	startTimeMs: number;
	endTimeMs: number;
}

interface DirectSource {
	type: "direct";
	url: string;
	duration: number;
	trimFrom?: number;
	trimTo?: number;
}

type ExportSource = ChannelRangeSource | DirectSource;

interface EditorExportBody {
	source: ExportSource;
	edits?: ExportEdits;
	output?: ExportOutput;
}

export const editorExportRouter: FastifyPluginAsync = async (
	fastify,
): Promise<void> => {
	const videoRenderUseCase = new VideoRenderUseCase(
		fastify.storage,
		fastify.config,
	);
	const editorExportUseCase = new EditorExportUseCase(videoRenderUseCase);

	fastify.post<{ Body: EditorExportBody }>(
		"/editor/export",
		async (request, reply) => {
			const { source, edits = {}, output = {} } = request.body;
			const format = output.format ?? "mp4";

			if (source.type === "channel-range") {
				return reply.status(400).send({
					error:
						"channel-range source requires a pre-resolved HLS src. Use POST /api/editor/preview-source first to get the HLS playlistUrl, then submit as a direct source.",
				});
			}

			const {
				url: sourceUrl,
				duration: sourceDuration,
				trimFrom,
				trimTo,
			} = source;
			const cuts: CutRange[] = edits.cuts ?? [];
			const timestamp = Date.now();
			const s3Key = `${fastify.config.S3_OUTPUT_PREFIX}/${timestamp}/rendered.${format === "dash" ? "mpd" : "mp4"}`;

			try {
				const result = await editorExportUseCase.execute({
					sourceUrl,
					sourceDuration,
					trimFrom,
					trimTo,
					cuts,
					format,
					s3Key,
				});

				return reply.status(200).send(result);
			} catch (err) {
				if (err instanceof RangeError) {
					return reply.status(400).send({ error: err.message });
				}
				throw err;
			}
		},
	);
};
