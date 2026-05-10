import { existsSync } from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import type { EnvConfig } from "../../config/env.ts";
import type { VideoSource } from "../../edit-video/edit-video.types.ts";
import { FFMPEG_COMMAND } from "../../ffmpeg/ffmpeg.consts.ts";
import {
	normalizeFfmpegDuration,
	normalizeFfmpegTime,
} from "../../utils/time.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import { isMpdUrl, processMpdSource } from "./dash-process.service.ts";
import { isHlsUrl, processHlsSource } from "./hls-process.service.ts";
import { processImageSource } from "./image-process.service.ts";

export const processSources = async (
	sources: VideoSource[],
	tempDir: string,
	storage: StorageProvider,
	config: EnvConfig,
): Promise<string> => {
	if (sources.length === 1) {
		const sourcePath = path.join(tempDir, "source-0.mp4");

		return await processSingleSource(
			sources[0] as VideoSource,
			sourcePath,
			tempDir,
			storage,
			config,
		);
	}
	const hasMpdSource = sources.some(
		(source) => isMpdUrl(source.url) || isHlsUrl(source.url),
	);
	const sourcePaths = await processMultipleSources(
		sources,
		tempDir,
		storage,
		config,
	);
	const hasImageSource = sources.some((source) => source.type === "image");
	const concatenatedPath = await concatenateSources(
		sources,
		sourcePaths,
		tempDir,
		hasMpdSource,
		hasImageSource,
		config,
	);

	return concatenatedPath;
};

const generateBlankVideoSegment = async (
	source: VideoSource,
	outputPath: string,
): Promise<void> => {
	const url = new URL(source.url);
	const width = Number.parseInt(url.searchParams.get("w") ?? "1920");
	const height = Number.parseInt(url.searchParams.get("h") ?? "1080");
	const fps = Number.parseInt(url.searchParams.get("fps") ?? "30");

	await new Promise<void>((resolve, reject) => {
		ffmpeg()
			.addOption(FFMPEG_COMMAND.HIDE_BANNER)
			.input(`color=c=black:s=${width}x${height}:r=${fps}`)
			.inputOptions([...FFMPEG_COMMAND.TREAT_AS_LIBAV_FILTER])
			.input("anullsrc=channel_layout=stereo:sample_rate=44100")
			.inputOptions([...FFMPEG_COMMAND.TREAT_AS_LIBAV_FILTER])
			.duration(source.duration)
			.videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
			.addOption("-pix_fmt", "yuv420p")
			.audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
			.audioBitrate(FFMPEG_COMMAND.AUDIO_BITRATE)
			.audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
			.audioChannels(2)
			.outputOptions([FFMPEG_COMMAND.OVERWRITE_OUTPUT])
			.save(outputPath)
			.on("end", () => resolve())
			.on("error", (err: Error) => reject(err));
	});
};

export const processSingleSource = async (
	source: VideoSource,
	sourcePath: string,
	tempDir: string,
	storage: StorageProvider,
	config: EnvConfig,
): Promise<string> => {
	if (source.url.startsWith("internal://blank")) {
		await generateBlankVideoSegment(source, sourcePath);

		return sourcePath;
	}
	if (source.type === "image") {
		await processImageSource(source, sourcePath, tempDir, storage);

		return sourcePath;
	}
	if (isMpdUrl(source.url)) {
		await processMpdSource(source, sourcePath, false, config);

		return sourcePath;
	}
	if (isHlsUrl(source.url)) {
		await processHlsSource(source, sourcePath, config);

		return sourcePath;
	}
	await storage.downloadToFile(source.url, sourcePath);

	if (source.trimFrom !== undefined || source.trimTo !== undefined) {
		const trimmedPath = path.join(tempDir, `trimmed-${Date.now()}.mp4`);
		const rawTrimFrom = source.trimFrom ?? 0;
		const seekInput = normalizeFfmpegTime(rawTrimFrom);
		await new Promise<void>((resolve, reject) => {
			const cmd = ffmpeg()
				.addOption(FFMPEG_COMMAND.HIDE_BANNER)
				.input(sourcePath)
				.seekInput(seekInput);

			if (source.trimTo !== undefined) {
				cmd.duration(normalizeFfmpegDuration(source.trimTo - rawTrimFrom));
			}

			cmd
				.outputOptions([
					FFMPEG_COMMAND.OVERWRITE_OUTPUT,
					...FFMPEG_COMMAND.COPY,
				])
				.save(trimmedPath)
				.on("end", () => resolve())
				.on("error", (err: Error) => reject(err));
		});
		await fsp.rename(trimmedPath, sourcePath);
	}

	return sourcePath;
};

export const processMultipleSources = async (
	sources: VideoSource[],
	tempDir: string,
	storage: StorageProvider,
	config: EnvConfig,
): Promise<string[]> => {
	const sourcePaths = await Promise.all(
		sources.map(async (source, index) => {
			const sourcePath = path.join(tempDir, `source-${index}.mp4`);
			return await processSingleSource(
				source,
				sourcePath,
				tempDir,
				storage,
				config,
			);
		}),
	);

	return sourcePaths;
};

export const concatenateSources = async (
	sources: VideoSource[],
	sourcePaths: string[],
	tempDir: string,
	hasMpdSource: boolean,
	hasImageSource: boolean,
	config: EnvConfig,
): Promise<string> => {
	const missing = sourcePaths.filter((p) => !existsSync(p));
	if (missing.length > 0) {
		throw new Error(
			`Concat failed: the following source file(s) do not exist: ${missing.join(", ")}`,
		);
	}

	const concatListPath = path.join(tempDir, "concat-list.txt");
	const concatenatedPath = path.join(tempDir, "concatenated.mp4");

	const concatLines = sourcePaths
		.map((p) => {
			const normalizedPath = p.replace(/\\/g, "/");
			const escapedPath = normalizedPath.replace(/'/g, "'\\''");
			return `file '${escapedPath}'`;
		})
		.join("\n");
	await fsp.writeFile(concatListPath, concatLines, "utf-8");

	const needsReencode = true;

	if (needsReencode) {
		const concatPreset = hasMpdSource ? "medium" : config.FFMPEG_PRESET;
		const concatCrf = hasMpdSource ? "18" : config.FFMPEG_CRF;

		await new Promise<void>((resolve, reject) => {
			ffmpeg()
				.addOption(FFMPEG_COMMAND.HIDE_BANNER)
				.input(concatListPath)
				.inputOptions([
					...FFMPEG_COMMAND.CONCAT_SAFE_0,
					...FFMPEG_COMMAND.GENERATE_MISSING_PTS,
				])
				.videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
				.addOption("-preset", concatPreset)
				.addOption("-crf", concatCrf)
				.addOption("-pix_fmt", "yuv420p")
				.videoFilters(FFMPEG_COMMAND.FORMAT_YUV420P)
				.outputOptions([
					FFMPEG_COMMAND.OVERWRITE_OUTPUT,
					...FFMPEG_COMMAND.AVOID_NEGATIVE_TIMESTAMPS,
				])
				.audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
				.audioBitrate(FFMPEG_COMMAND.AUDIO_BITRATE)
				.audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
				.audioChannels(2)
				.save(concatenatedPath)
				.on("end", () => resolve())
				.on("error", (err) => reject(err));
		});
	} else {
		await new Promise<void>((resolve, reject) => {
			ffmpeg()
				.addOption(FFMPEG_COMMAND.HIDE_BANNER)
				.input(concatListPath)
				.inputOptions([
					...FFMPEG_COMMAND.CONCAT_SAFE_0,
					...FFMPEG_COMMAND.GENERATE_MISSING_PTS,
				])
				.outputOptions([
					FFMPEG_COMMAND.OVERWRITE_OUTPUT,
					...FFMPEG_COMMAND.AVOID_NEGATIVE_TIMESTAMPS,
					...FFMPEG_COMMAND.COPY,
				])
				.save(concatenatedPath)
				.on("end", () => resolve())
				.on("error", (err) => reject(err));
		});
	}

	return concatenatedPath;
};
