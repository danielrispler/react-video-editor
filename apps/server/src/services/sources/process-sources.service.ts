import ffmpeg from 'fluent-ffmpeg';
import { existsSync } from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { isMpdUrl, processMpdSource } from "./dash-process.service";
import { processImageSource } from "./image-process.service";
import { StorageProvider } from '../storage/storage.types';
import { FFMPEG_COMMAND } from '../../ffmpeg/ffmpeg.consts';
import type { EnvConfig } from '../../config/env';
import { VideoSource } from '../../edit-video/edit-video.types';

export const processSources = async (sources: VideoSource[], tempDir: string, storage: StorageProvider, config: EnvConfig): Promise<string> => {
    if (sources.length === 1) {
        const sourcePath = path.join(tempDir, `source-0.mp4`);

        return await processSingleSource(sources[0] as VideoSource, sourcePath, tempDir, storage, config);
    } else {
        const hasMpdSource = sources.some(source => isMpdUrl(source.url));
        const sourcePaths = await processMultipleSources(sources, tempDir, storage, config);
        const hasImageSource = sources.some(source => source.type === 'image');
        const concatenatedPath = await concatenateSources(sources, sourcePaths, tempDir, hasMpdSource, hasImageSource, config);

        return concatenatedPath;
    }
}

export const processSingleSource = async (source: VideoSource, sourcePath: string, tempDir: string, storage: StorageProvider, config: EnvConfig): Promise<string> => {
    if (source.type === 'image') {
        await processImageSource(source, sourcePath, tempDir, storage);

        return sourcePath;
    } else if (isMpdUrl(source.url)) {
        await processMpdSource(source, sourcePath, false, config);

        return sourcePath;
    } else {
        await storage.downloadToFile(source.url, sourcePath);

        return sourcePath;
    }
}

export const processMultipleSources = async (sources: VideoSource[], tempDir: string, storage: StorageProvider, config: EnvConfig): Promise<string[]> => {
    const sourcePaths = await Promise.all(
        sources.map(async (source, index) => {
            const sourcePath = path.join(tempDir, `source-${index}.mp4`);
            return await processSingleSource(source, sourcePath, tempDir, storage, config);
        })
    );

    return sourcePaths;
}

export const concatenateSources = async (sources: VideoSource[], sourcePaths: string[], tempDir: string, hasMpdSource: boolean, hasImageSource: boolean, config: EnvConfig): Promise<string> => {
    const missing = sourcePaths.filter(p => !existsSync(p));
    if (missing.length > 0) {
        throw new Error(`Concat failed: the following source file(s) do not exist: ${missing.join(', ')}`);
    }

    const concatListPath = path.join(tempDir, 'concat-list.txt');
    const concatenatedPath = path.join(tempDir, 'concatenated.mp4');

    const concatLines = sourcePaths.map(p => {
        const normalizedPath = p.replace(/\\/g, '/');
        const escapedPath = normalizedPath.replace(/'/g, "'\\''");
        return `file '${escapedPath}'`;
    }).join('\n');
    await fsp.writeFile(concatListPath, concatLines, 'utf-8');

    const needsReencode = true;

    if (needsReencode) {
        const concatPreset = hasMpdSource ? 'medium' : config.FFMPEG_PRESET;
        const concatCrf = hasMpdSource ? '18' : config.FFMPEG_CRF;

        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .addOption(FFMPEG_COMMAND.HIDE_BANNER)
                .input(concatListPath)
                .inputOptions([...FFMPEG_COMMAND.CONCAT_SAFE_0,
                ...FFMPEG_COMMAND.GENERATE_MISSING_PTS])
                .videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
                .addOption('-preset', concatPreset)
                .addOption('-crf', concatCrf)
                .addOption('-pix_fmt', 'yuv420p')
                .videoFilters(FFMPEG_COMMAND.FORMAT_YUV420P)
                .outputOptions([FFMPEG_COMMAND.OVERWRITE_OUTPUT, ...FFMPEG_COMMAND.AVOID_NEGATIVE_TIMESTAMPS])
                .audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
                .audioBitrate(FFMPEG_COMMAND.AUDIO_BITRATE)
                .audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
                .audioChannels(2)
                .save(concatenatedPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    } else {
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .addOption(FFMPEG_COMMAND.HIDE_BANNER)
                .input(concatListPath)
                .inputOptions([...FFMPEG_COMMAND.CONCAT_SAFE_0, ...FFMPEG_COMMAND.GENERATE_MISSING_PTS])
                .outputOptions([
                    FFMPEG_COMMAND.OVERWRITE_OUTPUT,
                    ...FFMPEG_COMMAND.AVOID_NEGATIVE_TIMESTAMPS,
                    ...FFMPEG_COMMAND.COPY
                ])
                .save(concatenatedPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
    }

    return concatenatedPath;
};