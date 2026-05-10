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
