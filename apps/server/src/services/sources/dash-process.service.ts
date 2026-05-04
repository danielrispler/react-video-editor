import { promises as fsp } from 'node:fs';
import { runFfmpeg } from "../../ffmpeg/ffmpeg.utils.ts";
import { validateMpdRestrictions } from "../../utils/video.utils.ts";
import { FFMPEG_COMMAND } from '../../ffmpeg/ffmpeg.consts.ts';
import type { EnvConfig } from '../../config/env.ts';
import type { VideoSource } from '../../edit-video/edit-video.types.ts';

export const isMpdUrl = (url: string): boolean => url.toLowerCase().endsWith('.mpd');

export const processMpdSource = async (source: VideoSource, sourcePath: string, hasMpdSource: boolean, config: EnvConfig): Promise<void> => {
    console.log(`Processing MPD stream: ${source.url}`);

    await validateMpdRestrictions(source.url);
    const mpdCrf = hasMpdSource ? config.MPD_TRANSCODE_CRF_MULTI : config.MPD_TRANSCODE_CRF_SINGLE;
    console.log(`Transcoding MPD stream to MP4 (CRF ${mpdCrf})...`);

    await runFfmpeg(
        (command) => command
            .addOption(FFMPEG_COMMAND.HIDE_BANNER)
            .addOption(FFMPEG_COMMAND.OVERWRITE_OUTPUT)
            .input(source.url)
            .videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
            .addOption('-preset', config.MPD_TRANSCODE_PRESET)
            .addOption('-crf', mpdCrf)
            .fps(25)
            .outputOptions([
                ...FFMPEG_COMMAND.FORMAT_YUV420P,
                ...FFMPEG_COMMAND.CONSTANT_FRAME_RATE,
                ...FFMPEG_COMMAND.MOVE_METADATA_TO_BEGINNING,
            ])
            .audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
            .audioBitrate(FFMPEG_COMMAND.AUDIO_BITRATE)
            .audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
            .audioChannels(2)
            .outputOptions(FFMPEG_COMMAND.OUTPUT_SHORTEST_STREAM)
            .output(sourcePath),
        config.ENABLE_MPD_RESTRICTIONS ? config.TRANSCODE_TIMEOUT_MS : 0
    );

    if (config.ENABLE_MPD_RESTRICTIONS) {
        const stats = await fsp.stat(sourcePath);
        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB > config.MAX_TEMP_FILE_SIZE_MB) {
            await fsp.unlink(sourcePath);
            throw new Error(
                `Transcoded MPD file size (${Math.round(sizeMB)}MB) exceeds maximum allowed (${config.MAX_TEMP_FILE_SIZE_MB}MB)`
            );
        }
        console.log(`MPD transcoded successfully (${Math.round(sizeMB)}MB)`);
    } else {
        console.log(`MPD transcoded successfully`);
    }
}
