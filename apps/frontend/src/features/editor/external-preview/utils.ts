export const MAX_PREVIEW_DURATION_MS = 1000 * 60 * 60 * 6;

export const isLikelyHlsSrc = (src: string) => {
	try {
		const normalizedPath = new URL(
			src,
			window.location.href,
		).pathname.toLowerCase();
		return normalizedPath.endsWith(".m3u8") || normalizedPath.endsWith(".mpd");
	} catch {
		const lower = src.toLowerCase();
		return lower.includes(".m3u8") || lower.includes(".mpd");
	}
};

export const isLikelyAudioPlaylistSrc = (src: string) => {
	const normalized = src.toLowerCase();
	return (
		normalized.endsWith(".m3u8") ||
		normalized.endsWith(".mp3") ||
		normalized.endsWith(".wav") ||
		normalized.endsWith(".m4a") ||
		normalized.endsWith(".aac") ||
		normalized.endsWith(".ogg")
	);
};

export const isSafeMediaUrl = (src: string) => {
	try {
		const url = new URL(src, window.location.href);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

export const parseAllowedOrigins = (value?: string) =>
	new Set(
		(value || "")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
	);
