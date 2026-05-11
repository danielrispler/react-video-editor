import { z } from "zod";

const positiveNumber = z.number().finite().min(0);
const positiveDuration = z.number().finite().positive();
const nonEmptyString = z.string().trim().min(1);
const requestIdSchema = z.string().trim().min(1).optional();

export const hlsPlaybackSchema = z.strictObject({
	kind: z.literal("hls"),
	src: nonEmptyString,
});

export const mediaPlaybackSchema = z.strictObject({
	kind: z.union([z.literal("mp4"), z.literal("hls")]),
	src: nonEmptyString,
});

export const audioPlaybackSchema = z.strictObject({
	kind: z.union([z.literal("audio"), z.literal("hls")]),
	src: nonEmptyString,
});

export const recordingRangePayloadSchema = z
	.strictObject({
		kind: z.literal("recording-range"),
		channelId: nonEmptyString,
		startTimeMs: positiveNumber,
		endTimeMs: positiveNumber,
		durationMs: positiveDuration,
		playback: hlsPlaybackSchema.optional(),
		sourceOffsetMs: positiveNumber.optional(),
		posterSrc: nonEmptyString.optional(),
	})
	.superRefine((value, ctx) => {
		if (value.endTimeMs <= value.startTimeMs) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "endTimeMs must be greater than startTimeMs",
				path: ["endTimeMs"],
			});
		}

		if (
			value.sourceOffsetMs !== undefined &&
			value.sourceOffsetMs > value.durationMs
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "sourceOffsetMs must be less than or equal to durationMs",
				path: ["sourceOffsetMs"],
			});
		}
	});

export const mediaPayloadSchema = z.strictObject({
	kind: z.literal("media"),
	mediaId: nonEmptyString,
	durationMs: positiveNumber.optional(),
	playback: mediaPlaybackSchema,
	posterSrc: nonEmptyString.optional(),
});

export const audioRangePayloadSchema = z
	.strictObject({
		kind: z.literal("audio-range"),
		audioId: nonEmptyString,
		startTimeMs: positiveNumber.optional(),
		endTimeMs: positiveNumber.optional(),
		durationMs: positiveDuration,
		playback: audioPlaybackSchema,
		sourceOffsetMs: positiveNumber.optional(),
	})
	.superRefine((value, ctx) => {
		if (
			value.startTimeMs !== undefined &&
			value.endTimeMs !== undefined &&
			value.endTimeMs <= value.startTimeMs
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "endTimeMs must be greater than startTimeMs",
				path: ["endTimeMs"],
			});
		}

		if (
			value.sourceOffsetMs !== undefined &&
			value.sourceOffsetMs > value.durationMs
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "sourceOffsetMs must be less than or equal to durationMs",
				path: ["sourceOffsetMs"],
			});
		}
	});

export const previewItemPayloadSchema = z.union([
	recordingRangePayloadSchema,
	mediaPayloadSchema,
	audioRangePayloadSchema,
]);

export const editorAddPreviewItemMessageSchema = z.strictObject({
	type: z.literal("EDITOR_ADD_PREVIEW_ITEM"),
	requestId: requestIdSchema,
	payload: previewItemPayloadSchema,
});

export const editorClearProjectMessageSchema = z.strictObject({
	type: z.literal("EDITOR_CLEAR_PROJECT"),
	requestId: requestIdSchema,
});

export const parentToEditorMessageSchema = z.union([
	editorAddPreviewItemMessageSchema,
	editorClearProjectMessageSchema,
]);

export const editorPreviewItemAddedMessageSchema = z.strictObject({
	type: z.literal("EDITOR_PREVIEW_ITEM_ADDED"),
	requestId: requestIdSchema,
	itemId: nonEmptyString,
});

export const editorPreviewItemRejectedMessageSchema = z.strictObject({
	type: z.literal("EDITOR_PREVIEW_ITEM_REJECTED"),
	requestId: requestIdSchema,
	reason: nonEmptyString,
});

export const editorProjectClearedMessageSchema = z.strictObject({
	type: z.literal("EDITOR_PROJECT_CLEARED"),
	requestId: requestIdSchema,
});

export const editorToParentMessageSchema = z.union([
	editorPreviewItemAddedMessageSchema,
	editorPreviewItemRejectedMessageSchema,
	editorProjectClearedMessageSchema,
]);
