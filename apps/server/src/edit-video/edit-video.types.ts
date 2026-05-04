import { Static } from "@sinclair/typebox";
import { textOverlaySchema, imageOverlaySchema, rectangleOverlaySchema, circleOverlaySchema, overlaySchema, sourceSchema, audioSourceSchema, editVideoRequestSchema } from "./edit-video.schema";

export type TextOverlay = Static<typeof textOverlaySchema>;
export type ImageOverlay = Static<typeof imageOverlaySchema>;
export type RectangleOverlay = Static<typeof rectangleOverlaySchema>;
export type CircleOverlay = Static<typeof circleOverlaySchema>;
export type Overlay = Static<typeof overlaySchema>;
export type VideoSource = Static<typeof sourceSchema>;
export type AudioSource = Static<typeof audioSourceSchema>;
export type RenderRequest = Static<typeof editVideoRequestSchema>;