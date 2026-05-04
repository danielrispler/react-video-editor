import { Type } from "@sinclair/typebox";
import { OverlayType } from "../types/types.ts";

export const textOverlaySchema = Type.Object({
	id: Type.String({ format: "uuid" }),
	type: Type.Literal(OverlayType.text),
	text: Type.String(),
	start: Type.Number({ minimum: 0 }),
	end: Type.Number({ exclusiveMinimum: 0 }),
	trackOrder: Type.Optional(Type.Number()),
	x: Type.Number({ minimum: 0, maximum: 100 }),
	y: Type.Number({ minimum: 0, maximum: 100 }),
	fontSize: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
	fontColor: Type.Optional(Type.String()),
	backgroundColor: Type.Optional(Type.String()),
	opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
});

export const imageOverlaySchema = Type.Object({
	id: Type.String({ format: "uuid" }),
	type: Type.Literal(OverlayType.image),
	imageUrl: Type.String({ format: "uri" }),
	start: Type.Number({ minimum: 0 }),
	end: Type.Number({ exclusiveMinimum: 0 }),
	trackOrder: Type.Optional(Type.Number()),
	x: Type.Number({ minimum: 0, maximum: 100 }),
	y: Type.Number({ minimum: 0, maximum: 100 }),
	width: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	height: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
});

export const videoOverlaySchema = Type.Object({
	id: Type.String({ format: "uuid" }),
	type: Type.Literal(OverlayType.video),
	sourceUrl: Type.String({ format: "uri" }),
	start: Type.Number({ minimum: 0 }),
	end: Type.Number({ exclusiveMinimum: 0 }),
	trackOrder: Type.Number(),
	left: Type.Number(),
	top: Type.Number(),
	width: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	height: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
	transform: Type.Optional(Type.String()),
	trimFrom: Type.Optional(Type.Number({ minimum: 0 })),
	trimTo: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
	crop: Type.Optional(
		Type.Object({
			x: Type.Number({ minimum: 0 }),
			y: Type.Number({ minimum: 0 }),
			width: Type.Number({ minimum: 1 }),
			height: Type.Number({ minimum: 1 }),
		}),
	),
	blur: Type.Optional(Type.Number({ minimum: 0 })),
	brightness: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
	borderRadius: Type.Optional(Type.Number({ minimum: 0 })),
	rotation: Type.Optional(Type.Number()),
});

export const rectangleOverlaySchema = Type.Object({
	id: Type.String({ format: "uuid" }),
	type: Type.Literal(OverlayType.rectangle),
	start: Type.Number({ minimum: 0 }),
	end: Type.Number({ exclusiveMinimum: 0 }),
	trackOrder: Type.Optional(Type.Number()),
	x: Type.Number({ minimum: 0, maximum: 100 }),
	y: Type.Number({ minimum: 0, maximum: 100 }),
	width: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	height: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	color: Type.Optional(Type.String()),
	strokeWidth: Type.Optional(Type.Number({ minimum: 1, maximum: 20 })),
	fill: Type.Optional(Type.Boolean()),
	opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
});

export const circleOverlaySchema = Type.Object({
	id: Type.String({ format: "uuid" }),
	type: Type.Literal(OverlayType.circle),
	start: Type.Number({ minimum: 0 }),
	end: Type.Number({ exclusiveMinimum: 0 }),
	trackOrder: Type.Optional(Type.Number()),
	x: Type.Number({ minimum: 0, maximum: 100 }),
	y: Type.Number({ minimum: 0, maximum: 100 }),
	width: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	height: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
	color: Type.Optional(Type.String()),
	strokeWidth: Type.Optional(Type.Number({ minimum: 1, maximum: 20 })),
	fill: Type.Optional(Type.Boolean()),
	opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
});

export const overlaySchema = Type.Union([
	textOverlaySchema,
	imageOverlaySchema,
	videoOverlaySchema,
	rectangleOverlaySchema,
	circleOverlaySchema,
]);

export const sourceSchema = Type.Object({
	url: Type.String({ format: "uri" }),
	type: Type.Union([Type.Literal("video"), Type.Literal("image")]),
	duration: Type.Number({ minimum: 0.1, default: 5 }),
	trimFrom: Type.Optional(Type.Number({ minimum: 0 })),
	trimTo: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
});

export const audioSourceSchema = Type.Object({
	url: Type.String({ format: "uri" }),
	startTime: Type.Number({ minimum: 0 }),
	duration: Type.Number({ exclusiveMinimum: 0 }),
	originalDuration: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
	audioTrimStart: Type.Optional(Type.Number({ minimum: 0 })),
	audioTrimEnd: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
	volume: Type.Number({ minimum: 0, maximum: 1 }),
	muted: Type.Optional(Type.Boolean()),
	solo: Type.Optional(Type.Boolean()),
});

const cutSchema = Type.Object({
	start: Type.Number({ minimum: 0 }),
	end: Type.Number({ exclusiveMinimum: 0 }),
});

export const editVideoRequestSchema = Type.Object({
	sources: Type.Array(sourceSchema, { minItems: 1 }),
	sourceUrl: Type.Optional(Type.String({ format: "uri" })),
	trimEnd: Type.Number({ exclusiveMinimum: 0 }),
	cuts: Type.Array(cutSchema, { default: [] }),
	overlays: Type.Array(overlaySchema, { default: [] }),
	audioSources: Type.Array(audioSourceSchema, { default: [] }),
	audioMixMode: Type.Union([Type.Literal("mix"), Type.Literal("replace")], {
		default: "mix",
	}),
	format: Type.Literal("mp4", { default: "mp4" }),
	jobId: Type.String(),
});
