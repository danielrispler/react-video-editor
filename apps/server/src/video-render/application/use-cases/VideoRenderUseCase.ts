import type { EnvConfig } from "../../../config/env.ts";
import type {
	AudioSource,
	Overlay,
	VideoSource,
} from "../../../edit-video/edit-video.types.ts";
import { prepareOverlays } from "../../../services/overlays/overlay.service.ts";
import { prepareAudioSources } from "../../../services/sources/audio-process.service.ts";
import { processSources } from "../../../services/sources/process-sources.service.ts";
import type { StorageProvider } from "../../../services/storage/storage.types.ts";
import {
	extractSegments,
	finalRenderToS3,
} from "../../../services/video-processor.service.ts";
import type { TimeRange } from "../../../types/types.ts";
import { createTempDir } from "../../../utils/file.utils.ts";
import { calculateTotalDurationSegments } from "../../../utils/segment.utils.ts";
import { calculateKeepSegments } from "../../../utils/video.utils.ts";

export interface VideoRenderInput {
	sources: VideoSource[];
	trimEnd: number;
	cuts: { start: number; end: number }[];
	overlays: Overlay[];
	audioSources: AudioSource[];
	audioMixMode: "mix" | "replace";
	format: "mp4" | "webp" | "dash";
	frameTimeMs?: number;
	cropRegion?: { x: number; y: number; width: number; height: number };
}

export interface VideoRenderOutput {
	s3Key: string;
	url: string;
	segments: TimeRange[];
}

export class VideoRenderUseCase {
	private readonly storage: StorageProvider;
	private readonly config: EnvConfig;

	constructor(storage: StorageProvider, config: EnvConfig) {
		this.storage = storage;
		this.config = config;
	}

	async execute(
		input: VideoRenderInput,
		s3Key: string,
		onProgress?: (percent: number) => Promise<void>,
	): Promise<VideoRenderOutput> {
		const keepSegments = calculateKeepSegments(input);
		if (keepSegments.length === 0) {
			throw new Error("No video content would remain after trimming/cuts");
		}

		const totalDuration = calculateTotalDurationSegments(keepSegments);
		const tempDir = await createTempDir("render-");

		const sourcePath = await processSources(
			input.sources,
			tempDir,
			this.storage,
			this.config,
		);
		const segmentPaths = await extractSegments(
			sourcePath,
			keepSegments,
			tempDir,
			this.config,
		);
		const [{ overlayInputs, hasOverlays }, { audioPaths, hasAudio }] =
			await Promise.all([
				prepareOverlays(input.overlays, tempDir, this.storage, this.config),
				prepareAudioSources(
					input.audioSources ?? [],
					tempDir,
					totalDuration,
					this.storage,
					this.config,
				),
			]);

		const result = await finalRenderToS3(
			segmentPaths,
			overlayInputs,
			input.overlays,
			keepSegments,
			totalDuration,
			hasOverlays,
			input.sources,
			tempDir,
			input.format,
			audioPaths,
			hasAudio,
			input.audioMixMode,
			input.frameTimeMs,
			s3Key,
			this.storage,
			this.config,
			86400,
			onProgress
				? async (p: number) => {
						await onProgress(p);
					}
				: undefined,
			input.cropRegion,
		);

		return { s3Key: result.s3Key, url: result.url, segments: keepSegments };
	}
}
