import path from "node:path";
import sharp from 'sharp';
import type { VideoSource } from "../../edit-video/edit-video.types.ts";
import { FFMPEG_COMMAND } from "../../ffmpeg/ffmpeg.consts.ts";
import { runFfmpeg } from "../../ffmpeg/ffmpeg.utils.ts";
import type { StorageProvider } from "../storage/storage.types.ts";

export const getImageExtension = (url: string): string => {
    const clean = url.split('?')[0] || url;
    const ext = path.extname(clean).toLowerCase().replace('.', '');
    return ext.length > 0 ? ext : 'png';
};

export const convertWebpToPng = async (webpPath: string): Promise<string> => {
    const pngPath = webpPath.replace(/\.webp$/i, '.png');
    await sharp(webpPath).png().toFile(pngPath);
    return pngPath;
}

const createImagePath = (tempDir: string, ext: string): string => {
    return path.join(tempDir, `image-${Date.now()}.${ext}`);
};

export const processImageSource = async (source: VideoSource, sourcePath: string, tempDir: string, storage: StorageProvider): Promise<void> => {
    const originalExt = getImageExtension(source.url);
    const downloadedImagePath = createImagePath(tempDir, originalExt);
    await storage.downloadToFile(source.url, downloadedImagePath);
    const finalImagePath = originalExt === 'webp'
        ? await convertWebpToPng(downloadedImagePath)
        : downloadedImagePath;

    await runFfmpeg((command) => {
        return command
            .addOptions([FFMPEG_COMMAND.HIDE_BANNER, FFMPEG_COMMAND.OVERWRITE_OUTPUT])
            .input(finalImagePath)
            .inputOptions(FFMPEG_COMMAND.LOOP_INDEFINITE)
            .inputOptions(FFMPEG_COMMAND.NULL_AUDIO_STREAM)
            .inputOptions(FFMPEG_COMMAND.TREAT_AS_LIBAV_FILTER)
            .videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
            .duration(source.duration)
            .videoFilters(FFMPEG_COMMAND.FORMAT_YUV420P)
            .fps(25)
            .outputOptions(FFMPEG_COMMAND.CONSTANT_FRAME_RATE)
            .audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
            .audioBitrate(FFMPEG_COMMAND.AUDIO_BITRATE)
            .audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
            .audioChannels(2)
            .outputOptions(FFMPEG_COMMAND.OUTPUT_SHORTEST_STREAM)
            .save(sourcePath);
    });
}
