import path from "node:path";
import type { EnvConfig } from "../../config/env.ts";
import { hasAudioStream } from "../../ffmpeg/ffmpeg.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import { packToDash, uploadDashToS3 } from "../video-processor.service.ts";

export interface ExportContext {
	s3KeyPrefix: string;
	tempDir: string;
	storage: StorageProvider;
	config: EnvConfig;
	expiresInSeconds?: number;
}

export interface ExportHandoffResult {
	url: string;
	s3Key: string;
}

export interface ExportHandoffAdapter {
	handoff(
		mp4Path: string,
		context: ExportContext,
	): Promise<ExportHandoffResult>;
}

/**
 * Temporary fallback: packages the rendered MP4 as DASH and uploads to S3.
 *
 * TODO: Replace with a call to the external media ingestion service when available:
 *   POST {MEDIA_INGESTION_API_URL}/ingest
 *   Body: { mp4Path, channelId, ... }
 * The external service owns final segmentation, S3 upload, and media registration.
 */
export class DashFallbackAdapter implements ExportHandoffAdapter {
	async handoff(
		mp4Path: string,
		context: ExportContext,
	): Promise<ExportHandoffResult> {
		const { s3KeyPrefix, tempDir, storage, expiresInSeconds = 86400 } = context;

		const dashOutputDir = path.join(tempDir, `dash-export-${Date.now()}`);
		const { promises: fsp } = await import("node:fs");
		await fsp.mkdir(dashOutputDir, { recursive: true });

		const renderedHasAudio = await hasAudioStream(mp4Path).catch(() => false);
		await packToDash(mp4Path, dashOutputDir, renderedHasAudio);
		await uploadDashToS3(dashOutputDir, s3KeyPrefix, storage);

		const manifestKey = `${s3KeyPrefix}/manifest.mpd`;
		const url = await storage.getPresignedUrl(manifestKey, expiresInSeconds);
		return { url, s3Key: manifestKey };
	}
}
