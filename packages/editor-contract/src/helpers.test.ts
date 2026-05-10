import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createPreviewItemAddedMessage,
	createPreviewItemRejectedMessage,
	createProjectClearedMessage,
	isParentToEditorMessage,
	parseParentToEditorMessage,
} from "./helpers.js";
import {
	mockAudioRangeMessage,
	mockClearProjectMessage,
	mockMediaHlsMessage,
	mockMediaMp4Message,
	mockRecordingRangeHlsMessage,
	mockRecordingRangeNoPlaybackMessage,
} from "./mocks.js";
import { parentToEditorMessageSchema } from "./schemas.js";

const baseRecordingPayload = {
	kind: "recording-range" as const,
	channelId: "20574",
	startTimeMs: 1000,
	endTimeMs: 2000,
	durationMs: 1000,
	playback: { kind: "hls" as const, src: "https://example.com/index.m3u8" },
};

const baseAudioPayload = {
	kind: "audio-range" as const,
	audioId: "a1",
	startTimeMs: 1000,
	endTimeMs: 2000,
	durationMs: 1000,
	playback: { kind: "audio" as const, src: "https://example.com/track.m4a" },
};

describe("iframe contract schemas", () => {
	it("parses valid add-preview-item messages", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse(mockRecordingRangeHlsMessage)
				.success,
			true,
		);
		assert.equal(
			parentToEditorMessageSchema.safeParse(mockMediaMp4Message).success,
			true,
		);
		assert.equal(
			parentToEditorMessageSchema.safeParse(mockMediaHlsMessage).success,
			true,
		);
		assert.equal(
			parentToEditorMessageSchema.safeParse(mockAudioRangeMessage).success,
			true,
		);
	});

	it("accepts recording-range without playback (editor resolves HLS URL)", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse(mockRecordingRangeNoPlaybackMessage)
				.success,
			true,
		);
	});

	it("parses valid clear-project messages", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse(mockClearProjectMessage).success,
			true,
		);
	});

	it("rejects invalid message shapes", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				requestId: "bad",
			}).success,
			false,
		);
	});

	it("rejects durationMs = 0 for recording-range", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: { ...baseRecordingPayload, durationMs: 0 },
			}).success,
			false,
		);
	});

	it("rejects durationMs = 0 for audio-range", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: { ...baseAudioPayload, durationMs: 0 },
			}).success,
			false,
		);
	});

	it("rejects endTimeMs < startTimeMs for recording-range", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: { ...baseRecordingPayload, startTimeMs: 100, endTimeMs: 99 },
			}).success,
			false,
		);
	});

	it("rejects endTimeMs === startTimeMs (zero duration range) for recording-range", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: { ...baseRecordingPayload, startTimeMs: 100, endTimeMs: 100 },
			}).success,
			false,
		);
	});

	it("rejects endTimeMs === startTimeMs for audio-range", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: { ...baseAudioPayload, startTimeMs: 100, endTimeMs: 100 },
			}).success,
			false,
		);
	});

	it("accepts sourceOffsetMs = 0 (valid boundary)", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: { ...baseRecordingPayload, sourceOffsetMs: 0 },
			}).success,
			true,
		);
	});

	it("rejects sourceOffsetMs > durationMs", () => {
		assert.equal(
			parentToEditorMessageSchema.safeParse({
				type: "EDITOR_ADD_PREVIEW_ITEM",
				payload: {
					...baseRecordingPayload,
					durationMs: 1000,
					sourceOffsetMs: 1001,
				},
			}).success,
			false,
		);
	});
});

describe("iframe contract helpers", () => {
	it("detects valid parent-to-editor messages", () => {
		assert.equal(isParentToEditorMessage(mockMediaMp4Message), true);
		assert.equal(isParentToEditorMessage({ type: "UNKNOWN" }), false);
	});

	it("parses valid parent-to-editor messages", () => {
		const parsed = parseParentToEditorMessage(mockMediaHlsMessage);
		assert.equal(parsed.type, "EDITOR_ADD_PREVIEW_ITEM");
		if (parsed.type !== "EDITOR_ADD_PREVIEW_ITEM") {
			assert.fail("Expected an add-preview-item message");
		}
		assert.equal(parsed.payload.kind, "media");
	});

	it("creates response messages with the expected shapes", () => {
		assert.deepEqual(createPreviewItemAddedMessage("item-1", "req-1"), {
			type: "EDITOR_PREVIEW_ITEM_ADDED",
			requestId: "req-1",
			itemId: "item-1",
		});
		assert.deepEqual(createPreviewItemRejectedMessage("bad request", "req-2"), {
			type: "EDITOR_PREVIEW_ITEM_REJECTED",
			requestId: "req-2",
			reason: "bad request",
		});
		assert.deepEqual(createProjectClearedMessage("req-3"), {
			type: "EDITOR_PROJECT_CLEARED",
			requestId: "req-3",
		});
	});

	it("keeps all exported mocks schema-valid", () => {
		for (const message of [
			mockRecordingRangeHlsMessage,
			mockRecordingRangeNoPlaybackMessage,
			mockMediaMp4Message,
			mockMediaHlsMessage,
			mockAudioRangeMessage,
			mockClearProjectMessage,
		]) {
			assert.equal(
				parentToEditorMessageSchema.safeParse(message).success,
				true,
				`Mock failed schema validation: ${JSON.stringify(message)}`,
			);
		}
	});
});
