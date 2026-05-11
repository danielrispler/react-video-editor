import type { EnvConfig } from "../../config/env.ts";
import type { VideoSource } from "../../edit-video/edit-video.types.ts";
import { FFMPEG_COMMAND } from "../../ffmpeg/ffmpeg.consts.ts";
import { runFfmpeg } from "../../ffmpeg/ffmpeg.utils.ts";

export const isHlsUrl = (url: string): boolean => {
	try {
		return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
	} catch {
		return url.toLowerCase().includes(".m3u8");
	}
};

export const processHlsSource = async (
	source: VideoSource,
	sourcePath: string,
	config: EnvConfig,
): Promise<void> => {
	console.log(`Transcoding HLS stream to MP4: ${source.url}`);

	await runFfmpeg(
		(command) =>
			command
				.addOption(FFMPEG_COMMAND.HIDE_BANNER)
				.addOption(FFMPEG_COMMAND.OVERWRITE_OUTPUT)
				.input(source.url)
				.videoCodec(FFMPEG_COMMAND.H264_VIDEO_CODEC)
				.addOption("-preset", config.FFMPEG_PRESET)
				.addOption("-crf", config.FFMPEG_CRF)
				.fps(25)
				.videoFilters([
					FFMPEG_COMMAND.EVEN_DIMENSIONS,
					FFMPEG_COMMAND.FORMAT_YUV420P,
				])
				.outputOptions([
					...FFMPEG_COMMAND.CONSTANT_FRAME_RATE,
					...FFMPEG_COMMAND.MOVE_METADATA_TO_BEGINNING,
				])
				.audioCodec(FFMPEG_COMMAND.AAC_AUDIO_CODEC)
				.audioBitrate(FFMPEG_COMMAND.AUDIO_BITRATE)
				.audioFrequency(FFMPEG_COMMAND.AUDIO_FREQUENCY)
				.audioChannels(2)
				.outputOptions(FFMPEG_COMMAND.OUTPUT_SHORTEST_STREAM)
				.output(sourcePath),
		config.ENABLE_MPD_RESTRICTIONS ? config.TRANSCODE_TIMEOUT_MS : 0,
	);

	console.log("HLS stream transcoded successfully");
};
