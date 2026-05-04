import ffmpeg from 'fluent-ffmpeg';
import { existsSync, promises as fsp } from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import type { EnvConfig } from '../config/env';
import { RenderRequest, VideoSource } from '../edit-video/edit-video.types';
import { FFMPEG_COMMAND } from '../ffmpeg/ffmpeg.consts';
import { getFfmpegPath, hasAudioStream, runFfmpeg } from '../ffmpeg/ffmpeg.utils';
import { TimeRange } from '../types/types';
import { FfmpegCommandBuilder } from './ffmpeg/ffmpeg-command.builder';
import { StorageProvider } from './storage/storage.types';

const FFMPEG_PREFLIGHT_CONCAT = process.env.FFMPEG_PREFLIGHT_CONCAT !== '0';

export async function extractSegments(sourcePath: string, keepSegments: TimeRange[], tempDir: string): Promise<string[]> {
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
                .output(segmentPath)
        });

        segmentPaths.push(segmentPath);
    }

    return segmentPaths;
}

/** Validate that all segment paths exist; throw with clear message if any missing. */
function validateConcatSegmentsExist(segmentPaths: string[]): void {
    const missing = segmentPaths.filter(p => !existsSync(p));
    if (missing.length > 0) {
        throw new Error(
            `Concat preflight failed: the following segment file(s) do not exist: ${missing.join(', ')}`
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
            .format('null')
            .output('-')
    );
}

export const createConcatFile = async (segmentPaths: string[], tempDir: string): Promise<string> => {
    validateConcatSegmentsExist(segmentPaths);
    const concatFile = path.join(tempDir, 'concat.txt');
    const content = segmentPaths
        .map(p => p.replace(/\\/g, '/').replace(/'/g, "'\\''"))
        .map(p => `file '${p}'`)
        .join('\n');
    await fsp.writeFile(concatFile, content, 'utf8');
    if (FFMPEG_PREFLIGHT_CONCAT) {
        try {
            await preflightConcat(concatFile);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Concat preflight failed: ${msg}. Set FFMPEG_PREFLIGHT_CONCAT=0 to skip.`);
        }
    }
    return concatFile;
};

const shouldTranscode = (hasOverlays: boolean, keepSegments: TimeRange[], minTranscodeSegmentSeconds: number): boolean => {
    return hasOverlays ||
        keepSegments.length > 1 ||
        keepSegments.some(segment => segment.end - segment.start < minTranscodeSegmentSeconds);
};

export const finalRenderToS3 = async (
    segmentPaths: string[],
    imageOverlayPaths: string[],
    overlays: RenderRequest['overlays'],
    keepSegments: TimeRange[],
    totalDuration: number,
    hasOverlays: boolean,
    sources: VideoSource[],
    tempDir: string,
    format: string,
    audioPaths: { path: string; startTime: number; volume: number }[],
    hasAudio: boolean,
    audioMixMode: 'mix' | 'replace',
    s3Key: string,
    storage: StorageProvider,
    config: EnvConfig,
    expiresInSeconds: number = 86400,
    onProgress?: (percent: number) => void
): Promise<{ s3Key: string; url: string }> => {
    const concatFile = await createConcatFile(segmentPaths, tempDir);

    const videoHasAudio = segmentPaths.length > 0
        ? await hasAudioStream(segmentPaths[0]!).catch(() => false)
        : false;

    const needsTranscode = shouldTranscode(hasOverlays, keepSegments, config.MIN_TRANSCODE_SEGMENT_SECONDS);
    const needsProcessing = needsTranscode || hasAudio;

    ffmpeg.setFfmpegPath(getFfmpegPath());

    const builder = new FfmpegCommandBuilder(config);

    builder.addVideoSegments(concatFile)
        .addOverlays(imageOverlayPaths)
        .addAudioSources(audioPaths);

    const { videoStream, audioStreams } = builder.buildFilters(
        overlays,
        imageOverlayPaths,
        totalDuration,
        hasOverlays,
        audioPaths,
        hasAudio,
        audioMixMode,
        videoHasAudio
    );

    const command = builder.buildParameters(
        videoStream,
        audioStreams,
        needsProcessing,
        sources,
        format,
        videoHasAudio
    );

    const pass = new PassThrough();
    const contentType = format === 'mp4' ? 'video/mp4' : `video/${format}`;

    const ffmpegPromise = new Promise<void>((resolve, reject) => {
        let stderrBuffer = '';
        const appendStderr = (line: string): void => {
            stderrBuffer = (stderrBuffer + line + '\n').slice(-32768);
        };

        command
            .on('start', (commandLine: string) => {
                console.log('[ffmpeg]', commandLine);
            })
            .on('progress', (progress) => {
                if (onProgress) {
                    if (progress.percent && progress.percent > 0) {
                        onProgress(Math.min(99, Math.max(0, Math.round(progress.percent))));
                    } else if (progress.timemark && totalDuration > 0) {
                        const timeParts = progress.timemark.split(':');
                        if (timeParts.length === 3) {
                            const hours = parseFloat(timeParts[0]!);
                            const mins = parseFloat(timeParts[1]!);
                            const secs = parseFloat(timeParts[2]!);
                            const currentSeconds = hours * 3600 + mins * 60 + secs;
                            const percent = (currentSeconds / totalDuration) * 100;
                            onProgress(Math.min(99, Math.max(0, Math.round(percent))));
                        }
                    }
                }
            })
            .on('stderr', appendStderr)
            .on('error', (err) => {
                const enriched = new Error(
                    stderrBuffer.trim().length > 0
                        ? `${err.message}\n\nFFmpeg stderr (tail):\n${stderrBuffer}`
                        : err.message
                );
                pass.destroy(enriched);
                reject(enriched);
            })
            .on('end', () => {
                pass.end();
                resolve();
            })
            .pipe(pass, { end: false });
    });

    await Promise.all([ffmpegPromise, storage.uploadStream(pass, s3Key, contentType)]);
    const url = await storage.getPresignedUrl(s3Key, expiresInSeconds);
    return { s3Key, url };
};
