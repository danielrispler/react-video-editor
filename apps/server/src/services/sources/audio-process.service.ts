import { promises as fsp } from "node:fs";
import path from "node:path";
import type { EnvConfig } from "../../config/env.ts";
import type {
	AudioSource,
	RenderRequest,
} from "../../edit-video/edit-video.types.ts";
import { FFMPEG_COMMAND } from "../../ffmpeg/ffmpeg.consts.ts";
import { hasAudioStream, runFfmpeg } from "../../ffmpeg/ffmpeg.utils.ts";
import {
	normalizeFfmpegDuration,
	normalizeFfmpegTime,
} from "../../utils/time.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import { isMpdUrl } from "./dash-process.service.ts";
import { isHlsUrl } from "./hls-process.service.ts";

const AUDIO_FILE_EXTENSIONS = new Set([
	".aac",
	".flac",
	".m4a",
	".mp3",
	".oga",
	".ogg",
	".opus",
	".wav",
	".weba",
	".webm",
]);

export const getActiveAudioSources = (
	audioSources: RenderRequest["audioSources"],
): AudioSource[] => {
	if (!audioSources || audioSources.length === 0) {
		return [];
	}

	const hasSolo = audioSources.some((audio) => audio.solo);

	return audioSources.filter((audio) => {
		if (audio.muted) return false;
		return hasSolo ? audio.solo : true;
	});
};

export const calculateAudioProcessing = (
	audio: AudioSource,
	totalDurationSegments: number,
): {
	needsTrim: boolean;
	needsVolume: boolean;
	needsTimelineTrim: boolean;
	audioTrimStart: number;
	extractDuration: number;
} => {
	const audioTrimStart = audio.audioTrimStart ?? 0;
	const audioTrimEnd =
		audio.audioTrimEnd ?? audio.originalDuration ?? audio.duration;
	const audioTrimDuration = audioTrimEnd - audioTrimStart;

	const audioEndTime = audio.startTime + audio.duration;
	const needsTimelineTrim = audioEndTime > totalDurationSegments;
	const timelineTrimDuration = needsTimelineTrim
		? totalDurationSegments - audio.startTime
		: null;

	const needsTrim =
		audioTrimStart > 0 ||
		audioTrimEnd < (audio.originalDuration ?? audio.duration);
	const needsVolume = audio.volume !== 1.0;

	const extractDuration =
		needsTimelineTrim && timelineTrimDuration !== null
			? Math.min(timelineTrimDuration, audioTrimDuration)
			: audioTrimDuration;

	return {
		needsTrim,
		needsVolume,
		needsTimelineTrim:
			needsTimelineTrim &&
			timelineTrimDuration !== null &&
			timelineTrimDuration > 0,
		audioTrimStart,
		extractDuration,
	};
};

export const isLikelyAudioFileUrl = (url: string): boolean => {
	try {
		const extension = path.extname(new URL(url).pathname).toLowerCase();
		return AUDIO_FILE_EXTENSIONS.has(extension);
	} catch {
		return false;
	}
};

export const shouldProbeForEmbeddedAudio = (audio: AudioSource): boolean => {
	if (audio.sourceType === "audio") {
		return false;
	}

	if (audio.sourceType === "video") {
		return true;
	}

	return !isLikelyAudioFileUrl(audio.url);
};

export const processAudioFile = async (
	audio: AudioSource,
	audioPath: string,
	index: number,
	tempDir: string,
	totalDurationSegments: number,
): Promise<string> => {
	const processing = calculateAudioProcessing(audio, totalDurationSegments);

	if (processing.needsTimelineTrim && processing.extractDuration <= 0) {
		throw new Error("Audio starts after video ends");
	}

	const needsProcessing =
		processing.needsTrim ||
		processing.needsVolume ||
		processing.needsTimelineTrim;

	if (!needsProcessing) {
		return audioPath;
	}

	const processedPath = path.join(tempDir, `audio-${index}-processed.m4a`);

	await runFfmpeg((command) => {
		// Note: do NOT use .map() here when audioFilters() are also applied.
		// The explicit "-map 0:a:0" conflicts with the filter graph output label,
		// causing FFmpeg to error with "Output with label '0:a:0' does not exist".
		// For a single audio input, FFmpeg auto-selects the audio stream correctly.
		const cmdWithInput = command.input(audioPath);

		const cmdWithSeek =
			processing.audioTrimStart > 0
				? cmdWithInput.seekInput(normalizeFfmpegTime(processing.audioTrimStart))
				: cmdWithInput;

		const cmdWithDuration = cmdWithSeek.duration(
			normalizeFfmpegDuration(processing.extractDuration),
		);

		const filters: string[] = [];
		if (processing.needsVolume) {
			filters.push(`volume=${audio.volume.toFixed(3)}`);
		}

		const cmdWithFilters =
			filters.length > 0
				? cmdWithDuration.audioFilters(filters)
				: cmdWithDuration;

		return cmdWithFilters
			.audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
			.outputOptions(["-b:a", FFMPEG_COMMAND.AUDIO_BITRATE])
			.audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
			.audioChannels(2)
			.outputOptions([
				FFMPEG_COMMAND.HIDE_BANNER,
				FFMPEG_COMMAND.OVERWRITE_OUTPUT,
			])
			.output(processedPath);
	});

	return processedPath;
};

const materializeStreamingAudioSource = async (
	audio: AudioSource,
	audioPath: string,
	config: EnvConfig,
): Promise<void> => {
	await runFfmpeg((command) => {
		return command
			.addOption(FFMPEG_COMMAND.HIDE_BANNER)
			.addOption(FFMPEG_COMMAND.OVERWRITE_OUTPUT)
			.input(audio.url)
			.noVideo()
			.audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
			.outputOptions(["-b:a", FFMPEG_COMMAND.AUDIO_BITRATE])
			.audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
			.audioChannels(2)
			.output(audioPath);
	}, config.TRANSCODE_TIMEOUT_MS);
};

export const prepareAudioSources = async (
	audioSources: RenderRequest["audioSources"],
	tempDir: string,
	totalDurationSegments: number,
	storage: StorageProvider,
	config: EnvConfig,
): Promise<{
	audioPaths: { path: string; startTime: number; volume: number }[];
	hasAudio: boolean;
}> => {
	const activeAudio = getActiveAudioSources(audioSources);

	if (activeAudio.length === 0) {
		return { audioPaths: [], hasAudio: false };
	}

	const preparedAudioPaths = await Promise.all(
		activeAudio.map(async (audio, index) => {
			try {
				const isStreamingSource = isMpdUrl(audio.url) || isHlsUrl(audio.url);
				const audioExt = isStreamingSource
					? ".m4a"
					: path.extname(new URL(audio.url).pathname) || ".mp3";
				const audioPath = path.join(tempDir, `audio-${index}${audioExt}`);

				if (isStreamingSource) {
					if (shouldProbeForEmbeddedAudio(audio)) {
						const hasEmbeddedAudio = await hasAudioStream(audio.url);
						if (!hasEmbeddedAudio) {
							return null;
						}
					}
					await materializeStreamingAudioSource(audio, audioPath, config);
				} else {
					await storage.downloadToFile(audio.url, audioPath);
				}
				await fsp.access(audioPath);
				if (!isStreamingSource && shouldProbeForEmbeddedAudio(audio)) {
					const hasEmbeddedAudio = await hasAudioStream(audioPath);
					if (!hasEmbeddedAudio) {
						return null;
					}
				}

				const finalAudioPath = await processAudioFile(
					audio,
					audioPath,
					index,
					tempDir,
					totalDurationSegments,
				);

				return {
					path: finalAudioPath,
					startTime: audio.startTime,
					volume: audio.volume,
				};
			} catch (error) {
				console.error(`Failed to process audio ${audio.url}:`, error);
				throw new Error(`Failed to process audio: ${audio.url}`);
			}
		}),
	);
	const audioPaths = preparedAudioPaths.filter(
		(
			audioPath,
		): audioPath is { path: string; startTime: number; volume: number } =>
			audioPath !== null,
	);

	return { audioPaths, hasAudio: audioPaths.length > 0 };
};

export const buildAudioFilters = (
	audioPaths: { path: string; startTime: number; volume: number }[],
	audioInputStartIndex: number,
	audioMixMode: "mix" | "replace",
	videoHasAudio: boolean,
): { filterParts: string[]; audioStreams: string[] } => {
	const filterParts: string[] = [];
	const audioStreams: string[] = [];

	if (audioMixMode === "replace") {
		if (audioPaths.length === 1) {
			const [audio] = audioPaths;
			if (!audio) {
				return { filterParts, audioStreams };
			}
			const delay = Math.round(audio.startTime * 1000);
			filterParts.push(
				`[${audioInputStartIndex}:a]adelay=${delay}|${delay}[a0]`,
			);
			audioStreams.push("[a0]");
		} else {
			for (const [index, audio] of audioPaths.entries()) {
				const delay = Math.round(audio.startTime * 1000);
				filterParts.push(
					`[${audioInputStartIndex + index}:a]adelay=${delay}|${delay}[a${index}]`,
				);
				audioStreams.push(`[a${index}]`);
			}

			if (audioStreams.length > 1) {
				const mixInputs = audioStreams.join("");
				filterParts.push(
					`${mixInputs}amix=inputs=${audioStreams.length}:duration=shortest[amixed]`,
				);
				return { filterParts, audioStreams: ["[amixed]"] };
			}
		}
	} else {
		for (const [index, audio] of audioPaths.entries()) {
			const delay = Math.round(audio.startTime * 1000);
			filterParts.push(
				`[${audioInputStartIndex + index}:a]adelay=${delay}|${delay}[a${index}]`,
			);
			audioStreams.push(`[a${index}]`);
		}

		if (videoHasAudio) {
			audioStreams.push("[0:a]");
		}

		if (audioStreams.length > 1) {
			const mixInputs = audioStreams.join("");
			filterParts.push(
				`${mixInputs}amix=inputs=${audioStreams.length}:duration=shortest[amixed]`,
			);
			return { filterParts, audioStreams: ["[amixed]"] };
		}
	}

	return { filterParts, audioStreams };
};
