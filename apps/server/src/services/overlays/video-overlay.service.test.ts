import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import ffmpeg from "fluent-ffmpeg";
import type { EnvConfig } from "../../config/env.ts";
import { FFMPEG_COMMAND } from "../../ffmpeg/ffmpeg.consts.ts";
import {
	getFfmpegPath,
	getFfprobePath,
	runFfmpeg,
} from "../../ffmpeg/ffmpeg.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import { prepareVideoOverlay } from "./video-overlay.service.ts";

const testConfig: EnvConfig = {
	PORT: 4000,
	HOST: "127.0.0.1",
	MIN_TRANSCODE_SEGMENT_SECONDS: 0.35,
	FFMPEG_PRESET: "veryfast",
	FFMPEG_CRF: "20",
	FFMPEG_AUDIO_BITRATE: "192k",
	ENABLE_MPD_RESTRICTIONS: false,
	TRANSCODE_TIMEOUT_MS: 10000,
	MAX_TEMP_FILE_SIZE_MB: 100,
	MPD_TRANSCODE_CRF_MULTI: "10",
	MPD_TRANSCODE_CRF_SINGLE: "18",
	MPD_TRANSCODE_PRESET: "medium",
	S3_BUCKET: "test",
	S3_REGION: "us-east-1",
	S3_ENDPOINT: "http://localhost",
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

const probeDuration = async (filePath: string): Promise<number> => {
	return await new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) {
				reject(err);
				return;
			}

			resolve(Number.parseFloat(String(metadata.format?.duration ?? 0)));
		});
	});
};

describe("video-overlay.service", () => {
	let tempDir = "";
	let sourcePath = "";

	before(async () => {
		ffmpeg.setFfmpegPath(getFfmpegPath());
		const preferredFfprobePath = getFfprobePath();
		ffmpeg.setFfprobePath(
			existsSync(preferredFfprobePath)
				? preferredFfprobePath
				: "/opt/homebrew/bin/ffprobe",
		);

		tempDir = await mkdtemp(path.join(os.tmpdir(), "video-overlay-test-"));
		sourcePath = path.join(tempDir, "source.mp4");

		await runFfmpeg((command) => {
			return command
				.addOption(FFMPEG_COMMAND.HIDE_BANNER)
				.input("color=c=red:s=64x64:r=25")
				.inputOptions(FFMPEG_COMMAND.TREAT_AS_LIBAV_FILTER)
				.duration(2)
				.videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
				.outputOptions([
					FFMPEG_COMMAND.OVERWRITE_OUTPUT,
					"-pix_fmt",
					"yuv420p",
					"-g",
					"1",
				])
				.output(sourcePath);
		});
	});

	after(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("prepares trimmed temp files for secondary-row video overlays", async () => {
		const storage: StorageProvider = {
			uploadStream: async () => undefined,
			downloadToFile: async (_url, outputPath) => {
				await copyFile(sourcePath, outputPath);
			},
			getPresignedUrl: async () => "",
			getPresignedUploadUrl: async () => "",
			deleteFile: async () => undefined,
			ensureBucketExists: async () => undefined,
		};

		const preparedPath = await prepareVideoOverlay(
			{
				id: "prepared-video-overlay",
				type: "video",
				sourceUrl: "https://example.com/source.mp4",
				start: 0,
				end: 0.75,
				trackOrder: 1,
				left: 0,
				top: 0,
				width: 64,
				height: 64,
				trimFrom: 0.5,
				trimTo: 1.25,
			},
			tempDir,
			storage,
			testConfig,
		);

		const duration = await probeDuration(preparedPath);

		assert.ok(
			duration > 0.6,
			`expected trimmed duration to be > 0.6s, got ${duration}`,
		);
		assert.ok(
			duration < 0.9,
			`expected trimmed duration to be < 0.9s, got ${duration}`,
		);
	});
});
