import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import type { EnvConfig } from "../../config/env.ts";
import type {
	RenderRequest,
	VideoSource,
} from "../../edit-video/edit-video.types.ts";
import { FFMPEG_COMMAND } from "../../ffmpeg/ffmpeg.consts.ts";
import {
	type PreparedOverlayInput,
	buildOverlayFilters,
} from "../overlays/overlay.service.ts";
import { buildAudioFilters } from "../sources/audio-process.service.ts";
import { isMpdUrl } from "../sources/dash-process.service.ts";

export class FfmpegCommandBuilder {
	private command: FfmpegCommand;
	private filterParts: string[] = [];
	private inputsCount = 0;
	private readonly config: EnvConfig;

	constructor(config: EnvConfig) {
		this.command = ffmpeg();
		this.config = config;
	}

	public addVideoSegments(concatFile: string): this {
		this.command
			.input(concatFile)
			.inputOptions([
				...FFMPEG_COMMAND.CONCAT_SAFE_0,
				...FFMPEG_COMMAND.GENERATE_MISSING_PTS,
			]);
		this.inputsCount++;
		return this;
	}

	public addOverlayInputs(overlayInputs: PreparedOverlayInput[]): this {
		for (const overlayInput of overlayInputs) {
			this.command.input(overlayInput.path);
			this.inputsCount++;
		}
		return this;
	}

	public addAudioSources(
		audioPaths: { path: string; startTime: number; volume: number }[],
	): this {
		for (const audio of audioPaths) {
			this.command.input(audio.path);
			this.inputsCount++;
		}
		return this;
	}

	public buildFilters(
		overlays: RenderRequest["overlays"],
		overlayInputs: PreparedOverlayInput[],
		totalDuration: number,
		hasOverlays: boolean,
		audioPaths: { path: string; startTime: number; volume: number }[],
		hasAudio: boolean,
		audioMixMode: "mix" | "replace",
		videoHasAudio: boolean,
	): {
		videoStream: string;
		audioStreams: string[];
		needsVideoFilter: boolean;
	} {
		const overlayResult =
			hasOverlays && overlays && overlays.length > 0
				? (() => {
						const { filterComplex, outputStream } = buildOverlayFilters(
							overlays,
							overlayInputs,
							totalDuration,
						);
						if (filterComplex) {
							this.filterParts.push(filterComplex);
							return {
								videoStream: `[${outputStream}]`,
								needsVideoFilter: true,
							};
						}
						return { videoStream: "[0:v]", needsVideoFilter: false };
					})()
				: { videoStream: "[0:v]", needsVideoFilter: false };

		const needsVideoFilter = overlayResult.needsVideoFilter;

		const audioResult =
			hasAudio && audioPaths.length > 0
				? (() => {
						const audioInputStartIndex = overlayInputs.length + 1;

						const audioFilterResult = buildAudioFilters(
							audioPaths,
							audioInputStartIndex,
							audioMixMode,
							videoHasAudio,
						);
						this.filterParts.push(...audioFilterResult.filterParts);
						return audioFilterResult.audioStreams;
					})()
				: videoHasAudio && needsVideoFilter
					? (() => {
							this.filterParts.push("[0:a]anull[audioout]");
							return ["[audioout]"];
						})()
					: [];

		const finalVideoStream =
			this.filterParts.length > 0 &&
			!needsVideoFilter &&
			audioResult.length === 0
				? (() => {
						this.filterParts.unshift("[0:v]null[vout]");
						return "[vout]";
					})()
				: overlayResult.videoStream;

		return {
			videoStream: finalVideoStream,
			audioStreams: audioResult,
			needsVideoFilter,
		};
	}

	public buildParameters(
		videoStream: string,
		audioStreams: string[],
		needsProcessing: boolean,
		sources: VideoSource[],
		format: string,
		videoHasAudio: boolean,
		cropRegion?: { x: number; y: number; width: number; height: number },
	): FfmpegCommand {
		let finalVideoStream = videoStream;

		if (cropRegion && cropRegion.width > 0 && cropRegion.height > 0) {
			const cropFilter = `crop=${cropRegion.width}:${cropRegion.height}:${cropRegion.x}:${cropRegion.y}`;
			if (this.filterParts.length > 0) {
				// We already have a complex filter, append the crop filter to the end
				this.filterParts.push(`${finalVideoStream}${cropFilter}[cropout]`);
				finalVideoStream = "[cropout]";
			} else {
				// No complex filter, create one to handle the crop easily
				this.filterParts.push(`[0:v]${cropFilter}[cropout]`);
				finalVideoStream = "[cropout]";
			}
		}

		if (this.filterParts.length > 0) {
			this.command.complexFilter(this.filterParts.join(";"));
			this.command.outputOptions(["-map", finalVideoStream]);
			if (audioStreams.length > 0 && audioStreams[0]) {
				this.command.outputOptions(["-map", audioStreams[0]]);
			}
		} else {
			this.command.outputOptions(["-map", "0:v"]);
			if (videoHasAudio) {
				this.command.outputOptions(["-map", "0:a"]);
			}
		}

		if (needsProcessing) {
			const { preset, crf } = this.getEncodingSettings(sources);
			this.command
				.videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
				.addOption("-preset", preset)
				.addOption("-crf", crf)
				.addOption("-pix_fmt", "yuv420p")
				.audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
				.addOption("-shortest")
				.outputOptions(["-b:a", this.config.FFMPEG_AUDIO_BITRATE]);

			if (format === "mp4") {
				this.command.outputOptions(FFMPEG_COMMAND.MOVFLAGS_FRAG_FASTSTART);
			}
		} else {
			this.command.addOption("-c", "copy");
			if (format === "mp4") {
				this.command.outputOptions(FFMPEG_COMMAND.MOVFLAGS_FRAG_FASTSTART);
			}
		}

		this.command.format(format).outputOptions([FFMPEG_COMMAND.HIDE_BANNER]);
		return this.command;
	}

	private getEncodingSettings(sources: VideoSource[]): {
		preset: string;
		crf: string;
	} {
		const hasMpdSource = sources.some((s) => isMpdUrl(s.url));
		return {
			preset: hasMpdSource ? "medium" : this.config.FFMPEG_PRESET,
			crf: hasMpdSource ? "18" : this.config.FFMPEG_CRF,
		};
	}
}
