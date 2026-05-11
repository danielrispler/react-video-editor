import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import ffmpeg from "fluent-ffmpeg";
import type { EnvConfig } from "../../config/env.ts";
import { getFfmpegPath } from "../../ffmpeg/ffmpeg.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import {
	isLikelyAudioFileUrl,
	prepareAudioSources,
	shouldProbeForEmbeddedAudio,
} from "./audio-process.service.ts";

ffmpeg.setFfmpegPath(getFfmpegPath());

const testConfig: EnvConfig = {
	PORT: 4000,
	HOST: "127.0.0.1",
	MIN_TRANSCODE_SEGMENT_SECONDS: 0.35,
	FFMPEG_PRESET: "veryfast",
	FFMPEG_CRF: "20",
	FFMPEG_AUDIO_BITRATE: "192k",
	CHANNEL_PLAY_API_BASE_URL: "",
	SERVER_BASE_URL: "http://localhost:4000",
	MAX_PREVIEW_DURATION_MS: 3600000,
	PREVIEW_JOB_TTL_SECONDS: 86400,
	S3_PREVIEW_PREFIX: "preview",
	ENABLE_MPD_RESTRICTIONS: false,
	TRANSCODE_TIMEOUT_MS: 10000,
	MAX_TEMP_FILE_SIZE_MB: 100,
	MPD_TRANSCODE_CRF_MULTI: "10",
	MPD_TRANSCODE_CRF_SINGLE: "18",
	MPD_TRANSCODE_PRESET: "medium",
	S3_BUCKET: "test",
	S3_REGION: "us-east-1",
	S3_ENDPOINT: "http://localhost:9000",
	S3_FORCE_PATH_STYLE: true,
	S3_ACCESS_KEY_ID: "test",
	S3_SECRET_ACCESS_KEY: "test",
	S3_UPLOAD_PREFIX: "uploads",
	S3_OUTPUT_PREFIX: "output",
	S3_AUTO_CREATE_BUCKET: false,
	REDIS_HOST: "localhost",
	REDIS_PORT: 6379,
	REDIS_PASSWORD: "",
	JOB_PROGRESS_TTL_SECONDS: 600,
};

const tempDirs: string[] = [];

after(async () => {
	await Promise.all(
		tempDirs.map(async (tempDir) => {
			await fsp.rm(tempDir, { recursive: true, force: true });
		}),
	);
});

const makeTempDir = async (): Promise<string> => {
	const tempDir = await fsp.mkdtemp(
		path.join(os.tmpdir(), "audio-process-test-"),
	);
	tempDirs.push(tempDir);
	return tempDir;
};

const createSilentVideo = async (outputPath: string): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		ffmpeg()
			.input("color=c=blue:s=64x64:r=25")
			.inputOptions(["-f", "lavfi"])
			.duration(1)
			.videoCodec("libx264")
			.outputOptions(["-pix_fmt", "yuv420p", "-y"])
			.output(outputPath)
			.on("end", () => resolve())
			.on("error", (error) => reject(error))
			.run();
	});
};

const createAudioTone = async (outputPath: string): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		ffmpeg()
			.input("sine=frequency=440:sample_rate=44100:duration=1")
			.inputOptions(["-f", "lavfi"])
			.audioCodec("aac")
			.outputOptions(["-y"])
			.output(outputPath)
			.on("end", () => resolve())
			.on("error", (error) => reject(error))
			.run();
	});
};

describe("audio-process.service", () => {
	it("treats explicit audio-track sources as audio even when they are not video URLs", () => {
		assert.equal(isLikelyAudioFileUrl("https://example.com/audio.mp3"), true);
		assert.equal(
			shouldProbeForEmbeddedAudio({
				url: "https://example.com/audio-track",
				startTime: 0,
				duration: 1,
				volume: 1,
				sourceType: "audio",
			}),
			false,
		);
		assert.equal(
			shouldProbeForEmbeddedAudio({
				url: "https://example.com/video.mp4",
				startTime: 0,
				duration: 1,
				volume: 1,
				sourceType: "video",
			}),
			true,
		);
	});

	it("skips embedded video sources that do not contain an audio stream", async () => {
		const tempDir = await makeTempDir();
		const sourcePath = path.join(tempDir, "source.mp4");
		await createSilentVideo(sourcePath);

		const storage: StorageProvider = {
			downloadToFile: async (_url, destinationPath) => {
				await fsp.copyFile(sourcePath, destinationPath);
			},
			uploadStream: async () => {
				throw new Error("not implemented");
			},
			getPresignedUrl: async () => {
				throw new Error("not implemented");
			},
			getPresignedUploadUrl: async () => {
				throw new Error("not implemented");
			},
			deleteFile: async () => {
				throw new Error("not implemented");
			},
			ensureBucketExists: async () => {
				throw new Error("not implemented");
			},
		};

		const result = await prepareAudioSources(
			[
				{
					url: "https://example.com/silent-video.mp4",
					startTime: 0,
					duration: 1,
					volume: 1,
				},
			],
			tempDir,
			1,
			storage,
			testConfig,
		);

		assert.deepEqual(result, {
			audioPaths: [],
			hasAudio: false,
		});
	});

	it("keeps explicit audio-track sources in the render pipeline", async () => {
		const tempDir = await makeTempDir();
		const sourcePath = path.join(tempDir, "source.m4a");
		await createAudioTone(sourcePath);

		const storage: StorageProvider = {
			downloadToFile: async (_url, destinationPath) => {
				await fsp.copyFile(sourcePath, destinationPath);
			},
			uploadStream: async () => {
				throw new Error("not implemented");
			},
			getPresignedUrl: async () => {
				throw new Error("not implemented");
			},
			getPresignedUploadUrl: async () => {
				throw new Error("not implemented");
			},
			deleteFile: async () => {
				throw new Error("not implemented");
			},
			ensureBucketExists: async () => {
				throw new Error("not implemented");
			},
		};

		const result = await prepareAudioSources(
			[
				{
					url: "https://example.com/track-without-extension",
					startTime: 0,
					duration: 1,
					volume: 1,
					sourceType: "audio",
				},
			],
			tempDir,
			1,
			storage,
			testConfig,
		);

		assert.equal(result.hasAudio, true);
		assert.equal(result.audioPaths.length, 1);
	});
});
