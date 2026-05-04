import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import ffmpeg from "fluent-ffmpeg";
import { getFfmpegPath } from "../../ffmpeg/ffmpeg.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import {
	isLikelyAudioFileUrl,
	prepareAudioSources,
	shouldProbeForEmbeddedAudio,
} from "./audio-process.service.ts";

ffmpeg.setFfmpegPath(getFfmpegPath());

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
		);

		assert.equal(result.hasAudio, true);
		assert.equal(result.audioPaths.length, 1);
	});
});
