import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clampFrameTimeMs,
	getOutputContentType,
} from "./video-processor.service.ts";

describe("video processor helpers", () => {
	it("returns the correct content type for each export format", () => {
		assert.equal(getOutputContentType("mp4"), "video/mp4");
		assert.equal(getOutputContentType("webp"), "image/webp");
	});

	it("clamps requested frame times into the valid rendered range", () => {
		assert.equal(clampFrameTimeMs(undefined, 5), 0);
		assert.equal(clampFrameTimeMs(-250, 5), 0);
		assert.equal(clampFrameTimeMs(1250, 5), 1250);
		assert.equal(clampFrameTimeMs(99999, 5), 4999);
		assert.equal(clampFrameTimeMs(1500, 0), 0);
	});
});
