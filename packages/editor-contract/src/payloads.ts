export type HlsPlayback = {
	kind: "hls";
	src: string;
};

export type MediaPlayback = {
	kind: "mp4" | "hls";
	src: string;
};

export type AudioPlayback = {
	kind: "audio" | "hls";
	src: string;
};

export type Playback = HlsPlayback | MediaPlayback | AudioPlayback;

export const DEMO_PREVIEW_CHANNEL_ID = "demo-recording";
export const DEMO_PREVIEW_SEGMENT_START_MS = 1778412270000;
export const DEMO_PREVIEW_DEFAULT_START_MS =
	DEMO_PREVIEW_SEGMENT_START_MS + 6333;
export const DEMO_PREVIEW_DEFAULT_END_MS =
	DEMO_PREVIEW_SEGMENT_START_MS + 25000;

export type RecordingRangePayload = {
	kind: "recording-range";
	channelId: string;
	startTimeMs: number;
	endTimeMs: number;
	durationMs: number;
	/** When absent, the editor resolves the HLS playlist URL via POST /api/editor/preview-source. */
	playback?: HlsPlayback;
	sourceOffsetMs?: number;
	posterSrc?: string;
};

export type MediaPayload = {
	kind: "media";
	mediaId: string;
	durationMs?: number;
	playback: MediaPlayback;
	posterSrc?: string;
};

export type AudioRangePayload = {
	kind: "audio-range";
	audioId: string;
	startTimeMs?: number;
	endTimeMs?: number;
	durationMs: number;
	playback: AudioPlayback;
	sourceOffsetMs?: number;
};

export type PreviewItemPayload =
	| RecordingRangePayload
	| MediaPayload
	| AudioRangePayload;
