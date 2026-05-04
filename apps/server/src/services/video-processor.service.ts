import fs, { existsSync, promises as fsp } from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import sharp from "sharp";
import type { EnvConfig } from "../config/env.ts";
import type {
	RenderRequest,
	VideoSource,
} from "../edit-video/edit-video.types.ts";
import { FFMPEG_COMMAND } from "../ffmpeg/ffmpeg.consts.ts";
import {
	getFfmpegPath,
	hasAudioStream,
	runFfmpeg,
} from "../ffmpeg/ffmpeg.utils.ts";
import type { TimeRange } from "../types/types.ts";
import { FfmpegCommandBuilder } from "./ffmpeg/ffmpeg-command.builder.ts";
import type { PreparedOverlayInput } from "./overlays/overlay.service.ts";
import type { StorageProvider } from "./storage/storage.types.ts";

const FFMPEG_PREFLIGHT_CONCAT = process.env.FFMPEG_PREFLIGHT_CONCAT !== "0";

export async function extractSegments(
	sourcePath: string,
	keepSegments: TimeRange[],
	tempDir: string,
): Promise<string[]> {
	const segmentPaths: string[] = [];
	ffmpeg.setFfmpegPath(getFfmpegPath());

	for (const [index, segment] of keepSegments.entries()) {
		const segmentPath = path.join(tempDir, `segment-${index}.mp4`);
		const duration = segment.end - segment.start;

		await runFfmpeg((command) => {
			return command
				.input(sourcePath)
				.seekInput(segment.start)
				.duration(duration)
				.outputOptions([
					FFMPEG_COMMAND.HIDE_BANNER,
					FFMPEG_COMMAND.OVERWRITE_OUTPUT,
					...FFMPEG_COMMAND.AVOID_NEGATIVE_TIMESTAMPS,
					...FFMPEG_COMMAND.CONSTANT_FRAME_RATE,
					...FFMPEG_COMMAND.COPY,
				])
				.output(segmentPath);
		});

		segmentPaths.push(segmentPath);
	}

	return segmentPaths;
}

/** Validate that all segment paths exist; throw with clear message if any missing. */
function validateConcatSegmentsExist(segmentPaths: string[]): void {
	const missing = segmentPaths.filter((p) => !existsSync(p));
	if (missing.length > 0) {
		throw new Error(
			`Concat preflight failed: the following segment file(s) do not exist: ${missing.join(", ")}`,
		);
	}
}

/** Preflight: run ffmpeg -f concat -safe 0 -i concat.txt -c copy -t 0.1 -f null - to detect broken segments early. */
export async function preflightConcat(concatFilePath: string): Promise<void> {
	ffmpeg.setFfmpegPath(getFfmpegPath());
	await runFfmpeg((command) =>
		command
			.input(concatFilePath)
			.inputOptions(FFMPEG_COMMAND.CONCAT_SAFE_0)
			.outputOptions(FFMPEG_COMMAND.COPY)
			.duration(0.1)
			.format("null")
			.output("-"),
	);
}

export const createConcatFile = async (
	segmentPaths: string[],
	tempDir: string,
): Promise<string> => {
	validateConcatSegmentsExist(segmentPaths);
	const concatFile = path.join(tempDir, "concat.txt");
	const content = segmentPaths
		.map((p) => p.replace(/\\/g, "/").replace(/'/g, "'\\''"))
		.map((p) => `file '${p}'`)
		.join("\n");
	await fsp.writeFile(concatFile, content, "utf8");
	if (FFMPEG_PREFLIGHT_CONCAT) {
		try {
			await preflightConcat(concatFile);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			throw new Error(
				`Concat preflight failed: ${msg}. Set FFMPEG_PREFLIGHT_CONCAT=0 to skip.`,
			);
		}
	}
	return concatFile;
};

const shouldTranscode = (
	hasOverlays: boolean,
	keepSegments: TimeRange[],
	minTranscodeSegmentSeconds: number,
): boolean => {
	return (
		hasOverlays ||
		keepSegments.length > 1 ||
		keepSegments.some(
			(segment) => segment.end - segment.start < minTranscodeSegmentSeconds,
		)
	);
};

export const getOutputContentType = (
	format: RenderRequest["format"],
): string => (format === "webp" ? "image/webp" : "video/mp4");

export const clampFrameTimeMs = (
	frameTimeMs: number | undefined,
	totalDurationSeconds: number,
): number => {
	const totalDurationMs = Math.max(0, Math.round(totalDurationSeconds * 1000));
	const maxFrameTimeMs = Math.max(0, totalDurationMs - 1);

	if (typeof frameTimeMs !== "number" || !Number.isFinite(frameTimeMs)) {
		return 0;
	}

	return Math.min(maxFrameTimeMs, Math.max(0, Math.round(frameTimeMs)));
};

const attachProgressListener = (
	command: FfmpegCommand,
	totalDuration: number,
	onProgress?: (percent: number) => void,
) => {
	if (!onProgress) {
		return command;
	}

	return command.on("progress", (progress) => {
		if (progress.percent && progress.percent > 0) {
			onProgress(Math.min(99, Math.max(0, Math.round(progress.percent))));
			return;
		}

		if (!progress.timemark || totalDuration <= 0) {
			return;
		}

		const timeParts = progress.timemark.split(":");
		if (timeParts.length !== 3) return;

		const [hoursText, minsText, secsText] = timeParts;
		if (
			hoursText === undefined ||
			minsText === undefined ||
			secsText === undefined
		) {
			return;
		}

		const hours = Number.parseFloat(hoursText);
		const mins = Number.parseFloat(minsText);
		const secs = Number.parseFloat(secsText);
		const currentSeconds = hours * 3600 + mins * 60 + secs;
		const percent = (currentSeconds / totalDuration) * 100;
		onProgress(Math.min(99, Math.max(0, Math.round(percent))));
	});
};

const runCommandToStream = async (
	command: FfmpegCommand,
	totalDuration: number,
	storage: StorageProvider,
	s3Key: string,
	contentType: string,
	onProgress?: (percent: number) => void,
): Promise<void> => {
	const pass = new PassThrough();

	const ffmpegPromise = new Promise<void>((resolve, reject) => {
		let stderrBuffer = "";
		const appendStderr = (line: string): void => {
			stderrBuffer = `${stderrBuffer + line}\n`.slice(-32768);
		};

		attachProgressListener(command, totalDuration, onProgress)
			.on("start", (commandLine: string) => {
				console.log("[ffmpeg]", commandLine);
			})
			.on("stderr", appendStderr)
			.on("error", (err) => {
				const enriched = new Error(
					stderrBuffer.trim().length > 0
						? `${err.message}\n\nFFmpeg stderr (tail):\n${stderrBuffer}`
						: err.message,
				);
				pass.destroy(enriched);
				reject(enriched);
			})
			.on("end", () => {
				pass.end();
				resolve();
			})
			.pipe(pass, { end: false });
	});

	await Promise.all([
		ffmpegPromise,
		storage.uploadStream(pass, s3Key, contentType),
	]);
};

const runCommandToFile = async (
	command: FfmpegCommand,
	outputPath: string,
	totalDuration: number,
	onProgress?: (percent: number) => void,
): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		let stderrBuffer = "";
		const appendStderr = (line: string): void => {
			stderrBuffer = `${stderrBuffer + line}\n`.slice(-32768);
		};

		attachProgressListener(command, totalDuration, onProgress)
			.on("start", (commandLine: string) => {
				console.log("[ffmpeg]", commandLine);
			})
			.on("stderr", appendStderr)
			.on("error", (err) => {
				reject(
					new Error(
						stderrBuffer.trim().length > 0
							? `${err.message}\n\nFFmpeg stderr (tail):\n${stderrBuffer}`
							: err.message,
					),
				);
			})
			.on("end", () => resolve())
			.output(outputPath)
			.run();
	});
};

const extractFrameToImage = async (
	inputPath: string,
	outputPath: string,
	frameTimeMs: number,
): Promise<void> => {
	const seekTimeSeconds = frameTimeMs / 1000;

	await runFfmpeg((command) =>
		command
			.input(inputPath)
			.seekInput(seekTimeSeconds)
			.outputOptions([
				FFMPEG_COMMAND.HIDE_BANNER,
				FFMPEG_COMMAND.OVERWRITE_OUTPUT,
				"-frames:v",
				"1",
			])
			.noAudio()
			.format("image2")
			.output(outputPath),
	);
};

export const finalRenderToS3 = async (
	segmentPaths: string[],
	overlayInputs: PreparedOverlayInput[],
	overlays: RenderRequest["overlays"],
	keepSegments: TimeRange[],
	totalDuration: number,
	hasOverlays: boolean,
	sources: VideoSource[],
	tempDir: string,
	format: string,
	audioPaths: { path: string; startTime: number; volume: number }[],
	hasAudio: boolean,
	audioMixMode: "mix" | "replace",
	frameTimeMs: number | undefined,
	s3Key: string,
	storage: StorageProvider,
	config: EnvConfig,
	expiresInSeconds = 86400,
	onProgress?: (percent: number) => void,
	cropRegion?: { x: number; y: number; width: number; height: number },
): Promise<{ s3Key: string; url: string }> => {
	const concatFile = await createConcatFile(segmentPaths, tempDir);

	const videoHasAudio =
		segmentPaths.length > 0
			? await hasAudioStream(segmentPaths[0]).catch(() => false)
			: false;

	const needsTranscode = shouldTranscode(
		hasOverlays,
		keepSegments,
		config.MIN_TRANSCODE_SEGMENT_SECONDS,
	);
	const needsProcessing = needsTranscode || hasAudio || cropRegion !== undefined;

	ffmpeg.setFfmpegPath(getFfmpegPath());

	const builder = new FfmpegCommandBuilder(config);

	builder
		.addVideoSegments(concatFile)
		.addOverlayInputs(overlayInputs)
		.addAudioSources(audioPaths);

	const { videoStream, audioStreams } = builder.buildFilters(
		overlays,
		overlayInputs,
		totalDuration,
		hasOverlays,
		audioPaths,
		hasAudio,
		audioMixMode,
		videoHasAudio,
	);

	const command = builder.buildParameters(
		videoStream,
		audioStreams,
		needsProcessing,
		sources,
		format === "webp" ? "mp4" : format,
		videoHasAudio,
		cropRegion,
	);

	if (format === "webp") {
		const renderedVideoPath = path.join(tempDir, `rendered-${Date.now()}.mp4`);
		const renderedFramePath = path.join(tempDir, `rendered-${Date.now()}.png`);
		const renderedWebpPath = path.join(tempDir, `rendered-${Date.now()}.webp`);
		const safeFrameTimeMs = clampFrameTimeMs(frameTimeMs, totalDuration);

		await runCommandToFile(
			command,
			renderedVideoPath,
			totalDuration,
			onProgress,
		);
		await extractFrameToImage(
			renderedVideoPath,
			renderedFramePath,
			safeFrameTimeMs,
		);
		await sharp(renderedFramePath).webp().toFile(renderedWebpPath);
		await storage.uploadStream(
			fs.createReadStream(renderedWebpPath),
			s3Key,
			getOutputContentType("webp"),
		);
	} else {
		await runCommandToStream(
			command,
			totalDuration,
			storage,
			s3Key,
			getOutputContentType("mp4"),
			onProgress,
		);
	}

	const url = await storage.getPresignedUrl(s3Key, expiresInSeconds);
	return { s3Key, url };
};
