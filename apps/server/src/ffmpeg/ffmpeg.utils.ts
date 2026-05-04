import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import type { VideoMetadata } from "../types/types.ts";

export const getFfmpegPath = (): string => ffmpegInstaller.path;

export const getFfprobePath = (): string =>
	ffmpegInstaller.path.replace("ffmpeg", "ffprobe");

ffmpeg.setFfprobePath(getFfprobePath());

export const runFfmpeg = (
	builder: (command: ReturnType<typeof ffmpeg>) => ReturnType<typeof ffmpeg>,
	timeoutMs = 0,
): Promise<void> => {
	return new Promise((resolve, reject) => {
		const command = builder(ffmpeg());

		const state = { isTimedOut: false };
		const timeoutHandle: NodeJS.Timeout | null =
			timeoutMs > 0
				? setTimeout(() => {
						state.isTimedOut = true;
						command.kill("SIGKILL");
						reject(
							new Error(
								`FFmpeg transcode timed out after ${timeoutMs / 1000}s`,
							),
						);
					}, timeoutMs)
				: null;

		command
			.on("start", (commandLine: string) => {
				console.log("[ffmpeg]", commandLine);
			})
			.on("end", () => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (!state.isTimedOut) resolve();
			})
			.on("error", (err: Error) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (!state.isTimedOut) reject(err);
			})
			.run();
	});
};

export const probeMpdMetadata = (url: string): Promise<VideoMetadata> => {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(url, (err, metadata) => {
			if (err) {
				reject(new Error(`ffprobe failed: ${err.message}`));
				return;
			}

			try {
				const duration = Number.parseFloat(
					String(metadata.format?.duration ?? 0),
				);
				const videoStream = metadata.streams?.find(
					(stream) => stream.width != null && stream.height != null,
				);
				const width = videoStream?.width ?? 0;
				const height = videoStream?.height ?? 0;

				resolve({ duration, width, height });
			} catch (parseErr) {
				reject(new Error(`Failed to parse ffprobe output: ${parseErr}`));
			}
		});
	});
};

const doesStreamHaveAudio = (stream: ffmpeg.FfprobeStream): boolean =>
	stream.codec_type !== null && stream.codec_type === "audio";

export const hasAudioStream = (videoPath: string): Promise<boolean> =>
	new Promise((resolve) => {
		ffmpeg.ffprobe(videoPath, (err, metadata) => {
			const hasAudio = !!metadata?.streams?.some(doesStreamHaveAudio);
			resolve(!(!hasAudio || err));
		});
	});
