import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getRequestedFormat,
	getRequestedFrameTimeMs,
} from "./render.handler.ts";

describe("render handler helpers", () => {
	it("accepts webp and falls back unknown formats to mp4", () => {
		assert.equal(getRequestedFormat("webp"), "webp");
		assert.equal(getRequestedFormat("mp4"), "mp4");
		assert.equal(getRequestedFormat("gif"), "mp4");
		assert.equal(getRequestedFormat(undefined), "mp4");
	});

	it("keeps finite frame times and drops invalid values", () => {
		assert.equal(getRequestedFrameTimeMs(1250), 1250);
		assert.equal(getRequestedFrameTimeMs(-250), -250);
		assert.equal(getRequestedFrameTimeMs(Number.NaN), undefined);
		assert.equal(getRequestedFrameTimeMs(undefined), undefined);
	});
});
