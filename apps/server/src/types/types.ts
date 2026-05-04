export const OverlayType = {
	text: "text",
	image: "image",
	video: "video",
	rectangle: "rectangle",
	circle: "circle",
} as const;

export type OverlayTypeValue = (typeof OverlayType)[keyof typeof OverlayType];

export interface TimeRange {
	start: number;
	end: number;
}

export interface RenderResponse {
	jobId: string;
	outputFile: string;
	segments: TimeRange[];
	transcoded?: boolean | undefined;
}

export interface VideoMetadata {
	duration: number;
	width: number;
	height: number;
}
