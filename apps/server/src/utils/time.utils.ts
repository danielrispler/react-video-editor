import moment from "moment";

export const ONE_HOUR_IN_SECONDS = 60 * 60;
const FFMPEG_TIME_EPSILON = 1e-6;
const FFMPEG_TIME_PRECISION = 6;

export const parseTime = (timeStr: string): number => {
	const [hours, minutes, seconds] = timeStr.trim().split(":").map(Number);
	return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
};

export const formatTimestamp = (seconds: number): string =>
	moment.utc(seconds * 1000).format("HH:mm:ss.SSS");

export const normalizeFfmpegTime = (seconds: number): number => {
	if (!Number.isFinite(seconds)) {
		return 0;
	}

	const rounded = Number(seconds.toFixed(FFMPEG_TIME_PRECISION));
	return Math.abs(rounded) < FFMPEG_TIME_EPSILON ? 0 : rounded;
};

export const normalizeFfmpegDuration = (
	seconds: number,
	minimum = 0.01,
): number => Math.max(minimum, normalizeFfmpegTime(seconds));
