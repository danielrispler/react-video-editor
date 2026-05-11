import type { Static } from "@sinclair/typebox";
import type {
	audioSourceSchema,
	circleOverlaySchema,
	editVideoRequestSchema,
	imageOverlaySchema,
	overlaySchema,
	rectangleOverlaySchema,
	sourceSchema,
	textOverlaySchema,
	videoOverlaySchema,
} from "./edit-video.schema.ts";

export type TextOverlay = Static<typeof textOverlaySchema>;
export type ImageOverlay = Static<typeof imageOverlaySchema>;
export type VideoOverlay = Static<typeof videoOverlaySchema>;
export type RectangleOverlay = Static<typeof rectangleOverlaySchema>;
export type CircleOverlay = Static<typeof circleOverlaySchema>;
export type Overlay = Static<typeof overlaySchema>;
export type VideoSource = Static<typeof sourceSchema>;
export type AudioSource = Static<typeof audioSourceSchema>;
export type RenderRequest = Static<typeof editVideoRequestSchema>;
