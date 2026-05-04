import { FastifyInstance } from "fastify";
import { Request } from '../fastify/fastify';
import { prepareCircleOverlays } from "../services/overlays/circle-overlay.service";
import { prepareImageOverlays } from "../services/overlays/image-overlay.service";
import { prepareAudioSources } from "../services/sources/audio-process.service";
import { processSources } from "../services/sources/process-sources.service";
import { extractSegments, finalRenderToS3 } from "../services/video-processor.service";
import { OverlayType, RenderResponse } from '../types/types';
import { createTempDir } from "../utils/file.utils";
import { calculateTotalDurationSegments } from "../utils/segment.utils";
import { calculateKeepSegments } from "../utils/video.utils";
import { RenderRequest } from "./edit-video.types";

interface JobProgress {
    progress: number;
}

interface EditVideoHandlerType {
    editVideo: (req: Request<RenderRequest>) => Promise<RenderResponse>;
    getJobProgress: (req: Request<unknown, unknown, { jobId: string }>) => Promise<{ progress: number }>;
}

const getJobProgressKey = (jobId: string): string => `job:progress:${jobId}`;

export const EditVideoHandler = (): EditVideoHandlerType => {
    const safeSetProgress = async (fastify: FastifyInstance, jobId: string, progress: number): Promise<void> => {
        try {
            const config = fastify.config;
            const key = getJobProgressKey(jobId);
            const data: JobProgress = { progress };
            await fastify.redis.set(
                key,
                JSON.stringify(data),
                'EX',
                config.JOB_PROGRESS_TTL_SECONDS
            );
        } catch (err) {
            console.error(`[Redis Error] Failed to set progress for job ${jobId}:`, err);
        }
    };

    const safeDelProgress = async (fastify: FastifyInstance, jobId: string): Promise<void> => {
        try {
            await fastify.redis.del(getJobProgressKey(jobId));
        } catch (err) {
            console.error(`[Redis Error] Failed to delete progress for job ${jobId}:`, err);
        }
    };

    return {
        editVideo: async (req: Request<RenderRequest>): Promise<RenderResponse> => {
            const request = req.body;
            const fastify = req.server;
            const storage = fastify.storage;
            const config = fastify.config;

            try {
                const tempDir = await createTempDir('video-job-');

                const keepSegments = calculateKeepSegments(request);
                if (keepSegments.length === 0) throw new Error('No video content would remain after trimming/cuts');
                const totalDurationSegments = calculateTotalDurationSegments(keepSegments);

                const sourcePath = await processSources(request.sources, tempDir, storage, config);
                const segmentPaths = await extractSegments(sourcePath, keepSegments, tempDir);
                const { imageOverlayPaths, hasOverlays } = await prepareImageOverlays(request.overlays, tempDir);
                const circleOverlayPaths = await prepareCircleOverlays(request.overlays, tempDir);
                const allOverlayPaths = buildOverlayPathsInOrder(request.overlays, imageOverlayPaths, circleOverlayPaths);

                const { audioPaths, hasAudio } = await prepareAudioSources(request.audioSources || [], tempDir, totalDurationSegments, storage);

                const filename = `${Date.now()}.${request.format}`;
                const s3Key = `${config.S3_OUTPUT_PREFIX}/${filename}`;

                await safeSetProgress(fastify, request.jobId, 0);

                const result = await finalRenderToS3(
                    segmentPaths,
                    allOverlayPaths,
                    request.overlays,
                    keepSegments,
                    totalDurationSegments,
                    hasOverlays,
                    request.sources,
                    tempDir,
                    request.format,
                    audioPaths,
                    hasAudio,
                    request.audioMixMode || 'mix',
                    s3Key,
                    storage,
                    config,
                    86400,
                    (p) => safeSetProgress(fastify, request.jobId, p)
                );

                await safeDelProgress(fastify, request.jobId);

                return {
                    jobId: request.jobId,
                    outputFile: result.url,
                    segments: keepSegments,
                };
            } catch (e) {
                await safeDelProgress(fastify, req.body.jobId);
                throw e;
            }
        },
        getJobProgress: async (req: Request<unknown, unknown, { jobId: string }>): Promise<{ progress: number }> => {
            const jobId = req.params.jobId;
            try {
                const data = await req.server.redis.get(getJobProgressKey(jobId));
                if (!data) return { progress: 0 };

                const parsed = JSON.parse(data) as JobProgress;
                return { progress: parsed.progress ?? 0 };
            } catch (err) {
                console.error(`[Redis Error] Failed to get progress for job ${jobId}:`, err);
                throw new Error(`Failed to retrieve progress for job ${jobId}`);
            }
        }
    };
};

const buildOverlayPathsInOrder = (
    overlays: RenderRequest['overlays'],
    imageOverlayPaths: string[],
    circleOverlayPaths: string[]
): string[] => {
    const sorted = [...overlays].sort((a, b) => a.start - b.start);
    const result: string[] = [];
    let imageIdx = 0;
    let circleIdx = 0;
    for (const overlay of sorted) {
        if (overlay.type === OverlayType.image) {
            if (imageIdx < imageOverlayPaths.length) result.push(imageOverlayPaths[imageIdx++]!);
        } else if (overlay.type === OverlayType.circle) {
            if (circleIdx < circleOverlayPaths.length) result.push(circleOverlayPaths[circleIdx++]!);
        }
    }
    return result;
};
