import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { StorageProvider } from "../storage/storage.types.ts";

export interface PreviewJob {
	jobId: string;
	playlistUrl: string;
}

/**
 * Stores an HLS playlist string in S3 and returns a presigned URL.
 * No Redis, no MP4 generation, no segment copying.
 */
export const storePreviewPlaylist = async (
	playlist: string,
	s3Prefix: string,
	storage: StorageProvider,
	expiresInSeconds: number,
): Promise<PreviewJob> => {
	const jobId = randomUUID();
	const s3Key = `${s3Prefix}/${jobId}/index.m3u8`;

	const stream = Readable.from([playlist]);
	await storage.uploadStream(stream, s3Key, "application/vnd.apple.mpegurl");

	const playlistUrl = await storage.getPresignedUrl(s3Key, expiresInSeconds);

	return { jobId, playlistUrl };
};
