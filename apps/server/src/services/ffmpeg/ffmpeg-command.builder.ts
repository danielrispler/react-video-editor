import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import type { RenderRequest, VideoSource } from '../../edit-video/edit-video.types.ts';
import { FFMPEG_COMMAND } from '../../ffmpeg/ffmpeg.consts.ts';
import { buildOverlayFilters } from '../overlays/overlay.service.ts';
import { buildAudioFilters } from '../sources/audio-process.service.ts';
import { isMpdUrl } from '../sources/dash-process.service.ts';
import type { EnvConfig } from '../../config/env.ts';

export class FfmpegCommandBuilder {
    private command: FfmpegCommand;
    private filterParts: string[] = [];
    private inputsCount = 0;
    private readonly config: EnvConfig;

    constructor(config: EnvConfig) {
        this.command = ffmpeg();
        this.config = config;
    }

    public addVideoSegments(concatFile: string): this {
        this.command
            .input(concatFile)
            .inputOptions([...FFMPEG_COMMAND.CONCAT_SAFE_0, ...FFMPEG_COMMAND.GENERATE_MISSING_PTS]);
        this.inputsCount++;
        return this;
    }

    public addOverlays(imageOverlayPaths: string[]): this {
        imageOverlayPaths.forEach(imagePath => {
            this.command.input(imagePath);
            this.inputsCount++;
        });
        return this;
    }

    public addAudioSources(audioPaths: { path: string; startTime: number; volume: number }[]): this {
        audioPaths.forEach(audio => {
            this.command.input(audio.path);
            this.inputsCount++;
        });
        return this;
    }

    public buildFilters(
        overlays: RenderRequest['overlays'],
        imageOverlayPaths: string[],
        totalDuration: number,
        hasOverlays: boolean,
        audioPaths: { path: string; startTime: number; volume: number }[],
        hasAudio: boolean,
        audioMixMode: 'mix' | 'replace',
        videoHasAudio: boolean
    ): { videoStream: string; audioStreams: string[]; needsVideoFilter: boolean } {
        const overlayResult = hasOverlays && overlays && overlays.length > 0
            ? (() => {
                const { filterComplex, outputStream } = buildOverlayFilters(overlays, imageOverlayPaths, totalDuration);
                if (filterComplex) {
                    this.filterParts.push(filterComplex);
                    return { videoStream: `[${outputStream}]`, needsVideoFilter: true };
                }
                return { videoStream: '[0:v]', needsVideoFilter: false };
            })()
            : { videoStream: '[0:v]', needsVideoFilter: false };

        const needsVideoFilter = overlayResult.needsVideoFilter;

        const audioResult = hasAudio && audioPaths.length > 0
            ? (() => {
                const audioInputStartIndex = hasOverlays && imageOverlayPaths.length > 0
                    ? imageOverlayPaths.length + 1
                    : 1;

                const audioFilterResult = buildAudioFilters(
                    audioPaths,
                    audioInputStartIndex,
                    audioMixMode,
                    videoHasAudio
                );
                this.filterParts.push(...audioFilterResult.filterParts);
                return audioFilterResult.audioStreams;
            })()
            : videoHasAudio && needsVideoFilter
                ? (() => {
                    this.filterParts.push(`[0:a]anull[audioout]`);
                    return ['[audioout]'];
                })()
                : [];

        const finalVideoStream = this.filterParts.length > 0 && !needsVideoFilter && audioResult.length === 0
            ? (() => {
                this.filterParts.unshift(`[0:v]null[vout]`);
                return '[vout]';
            })()
            : overlayResult.videoStream;

        return {
            videoStream: finalVideoStream,
            audioStreams: audioResult,
            needsVideoFilter
        };
    }

    public buildParameters(
        videoStream: string,
        audioStreams: string[],
        needsProcessing: boolean,
        sources: VideoSource[],
        format: string,
        videoHasAudio: boolean
    ): FfmpegCommand {
        if (this.filterParts.length > 0) {
            this.command.complexFilter(this.filterParts.join(';'));
            this.command.outputOptions(['-map', videoStream]);
            if (audioStreams.length > 0 && audioStreams[0]) {
                this.command.outputOptions(['-map', audioStreams[0]]);
            }
        } else {
            this.command.outputOptions(['-map', '0:v']);
            if (videoHasAudio) {
                this.command.outputOptions(['-map', '0:a']);
            }
        }

        if (needsProcessing) {
            const { preset, crf } = this.getEncodingSettings(sources);
            this.command
                .videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
                .addOption('-preset', preset)
                .addOption('-crf', crf)
                .addOption('-pix_fmt', 'yuv420p')
                .audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
                .addOption('-shortest')
                .outputOptions(['-b:a', this.config.FFMPEG_AUDIO_BITRATE]);

            if (format === 'mp4') {
                this.command.outputOptions(FFMPEG_COMMAND.MOVFLAGS_FRAG_FASTSTART);
            }
        } else {
            this.command.addOption('-c', 'copy');
            if (format === 'mp4') {
                this.command.outputOptions(FFMPEG_COMMAND.MOVFLAGS_FRAG_FASTSTART);
            }
        }

        this.command.format(format).outputOptions([FFMPEG_COMMAND.HIDE_BANNER]);
        return this.command;
    }

    private getEncodingSettings(sources: VideoSource[]): { preset: string; crf: string } {
        const hasMpdSource = sources.some(s => isMpdUrl(s.url));
        return {
            preset: hasMpdSource ? 'medium' : this.config.FFMPEG_PRESET,
            crf: hasMpdSource ? '18' : this.config.FFMPEG_CRF
        };
    }
}
