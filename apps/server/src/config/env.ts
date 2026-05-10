import fastifyEnv from "@fastify/env";
import { type Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";

export const envSchema = Type.Object({
	// Server
	PORT: Type.Number({ default: 4000 }),
	HOST: Type.String({ default: "127.0.0.1" }),
	MIN_TRANSCODE_SEGMENT_SECONDS: Type.Number({ default: 0.35 }),
	FFMPEG_PRESET: Type.String({ default: "veryfast" }),
	FFMPEG_CRF: Type.String({ default: "20" }),
	FFMPEG_AUDIO_BITRATE: Type.String({ default: "192k" }),
	// Preview source (MPD → HLS)
	CHANNEL_PLAY_API_BASE_URL: Type.String({ default: "" }),
	SERVER_BASE_URL: Type.String({ default: "http://localhost:4000" }),
	MAX_PREVIEW_DURATION_MS: Type.Number({ default: 3600000 }), // 1 hour
	PREVIEW_JOB_TTL_SECONDS: Type.Number({ default: 86400 }),
	S3_PREVIEW_PREFIX: Type.String({ default: "preview" }),
	// MPD
	ENABLE_MPD_RESTRICTIONS: Type.Boolean({ default: false }),
	TRANSCODE_TIMEOUT_MS: Type.Number({ default: 7200000 }),
	MAX_TEMP_FILE_SIZE_MB: Type.Number({ default: 5000 }),
	MPD_TRANSCODE_CRF_MULTI: Type.String({ default: "10" }),
	MPD_TRANSCODE_CRF_SINGLE: Type.String({ default: "18" }),
	MPD_TRANSCODE_PRESET: Type.String({ default: "medium" }),
	// S3
	S3_BUCKET: Type.String({ default: "video-editor" }),
	S3_REGION: Type.String({ default: "us-east-1" }),
	S3_ENDPOINT: Type.String({ default: "http://localhost:9000" }),
	S3_FORCE_PATH_STYLE: Type.Boolean({ default: true }),
	S3_ACCESS_KEY_ID: Type.String({ default: "minioadmin" }),
	S3_SECRET_ACCESS_KEY: Type.String({ default: "minioadmin123" }),
	S3_UPLOAD_PREFIX: Type.String({ default: "uploads" }),
	S3_OUTPUT_PREFIX: Type.String({ default: "output" }),
	S3_AUTO_CREATE_BUCKET: Type.Boolean({ default: true }),
	// Redis
	REDIS_HOST: Type.String({ default: "localhost" }),
	REDIS_PORT: Type.Number({ default: 6379 }),
	REDIS_PASSWORD: Type.String({ default: "" }),
	JOB_PROGRESS_TTL_SECONDS: Type.Number({ default: 600 }),
});

export type EnvConfig = Static<typeof envSchema>;

export const envPlugin = fp(
	async (fastify) => {
		await fastify.register(fastifyEnv, {
			schema: envSchema,
			dotenv: true,
		});
	},
	{ name: "env-plugin" },
);

declare module "fastify" {
	interface FastifyInstance {
		config: EnvConfig;
	}
}
