import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { generateHlsPlaylist } from "./mpd-to-hls.service.ts";

const fixturesDir = path.join(
	import.meta.dirname,
	"../sources/__fixtures__/hls-preview",
);

const sampleMpd = readFileSync(path.join(fixturesDir, "sample.mpd"), "utf-8");
const expectedM3u8 = readFileSync(
	path.join(fixturesDir, "expected.m3u8"),
	"utf-8",
);
const playResponse = JSON.parse(
	readFileSync(path.join(fixturesDir, "sample-play-response.json"), "utf-8"),
) as {
	segmentStartTimeMs: number;
	requestedStartTimeMs: number;
	requestedEndTimeMs: number;
	sourceOffsetMs: number;
};

const BASE_URL = "https://example.com/streams/mock-recording";

// The expected.m3u8 fixture has exactly 2 segments (426 and 427).
// Use a range that falls within those two 15-second segments.
// Segment 426 starts at segmentStartTimeMs = 1778412270000 and ends at +15000.
// Segment 427 starts at +15000 and ends at +30000.
// We request a range starting inside segment 426 (sourceOffsetMs = 6333) and ending inside 427.
const TEST_START_MS = playResponse.segmentStartTimeMs + 6333; // = requestedStartTimeMs
const TEST_END_MS = playResponse.segmentStartTimeMs + 25000; // inside segment 427

describe("MPD → HLS conversion", () => {
	it("parses SegmentTemplate and derives segment duration: 1350000 / 90000 = 15s", () => {
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: TEST_END_MS,
		});
		assert.ok(
			result.playlist.includes("#EXT-X-TARGETDURATION:15"),
			"target duration must be 15",
		);
	});

	it("generates EXT-X-MAP with init segment URI", () => {
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: TEST_END_MS,
		});
		assert.ok(
			result.playlist.includes(`#EXT-X-MAP:URI="${BASE_URL}/v2_init.mp4"`),
			"EXT-X-MAP must reference v2_init.mp4",
		);
	});

	it("generates EXTINF entries for correct .m4s segments", () => {
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: TEST_END_MS,
		});
		assert.ok(
			result.playlist.includes("segment_v2_426.m4s"),
			"must include segment 426",
		);
		assert.ok(
			result.playlist.includes("segment_v2_427.m4s"),
			"must include segment 427",
		);
		assert.ok(
			!result.playlist.includes("segment_v2_425.m4s"),
			"must not include segment before range",
		);
	});

	it("output playlist matches expected.m3u8 fixture (2-segment range)", () => {
		// Build a request whose output exactly matches the fixture (segments 426 and 427).
		// expected.m3u8 has MEDIA-SEQUENCE:426 and two segments.
		// We need requestedEnd to be inside segment 427 but not reach segment 428.
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: TEST_END_MS,
		});
		assert.equal(
			result.playlist.trim(),
			expectedM3u8.trim(),
			"Generated playlist does not match expected.m3u8",
		);
	});

	it("computes sourceOffsetMs correctly from play response", () => {
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: playResponse.requestedStartTimeMs,
			requestedEndMs: playResponse.requestedStartTimeMs + 20000,
		});
		assert.equal(
			result.sourceOffsetMs,
			playResponse.sourceOffsetMs,
			"sourceOffsetMs must be 6333",
		);
	});

	it("includes segment when requestedEndMs falls inside it", () => {
		// requestedEnd is 1ms into segment 427 — segment 427 must be included
		const segEnd426 = playResponse.segmentStartTimeMs + 15000;
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: segEnd426 + 1,
		});
		assert.ok(
			result.playlist.includes("segment_v2_427.m4s"),
			"must include segment 427 when end falls inside it",
		);
	});

	it("generates VOD playlist with #EXT-X-PLAYLIST-TYPE:VOD and #EXT-X-ENDLIST", () => {
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: TEST_END_MS,
		});
		assert.ok(
			result.playlist.includes("#EXT-X-PLAYLIST-TYPE:VOD"),
			"must be VOD type",
		);
		assert.ok(
			result.playlist.includes("#EXT-X-ENDLIST"),
			"must have EXT-X-ENDLIST",
		);
	});

	it("rejects endTimeMs <= startTimeMs", () => {
		assert.throws(
			() =>
				generateHlsPlaylist({
					mpdXml: sampleMpd,
					baseUrl: BASE_URL,
					segmentStartTimeMs: playResponse.segmentStartTimeMs,
					requestedStartMs: 1000,
					requestedEndMs: 1000,
				}),
			/greater than/,
		);

		assert.throws(
			() =>
				generateHlsPlaylist({
					mpdXml: sampleMpd,
					baseUrl: BASE_URL,
					segmentStartTimeMs: playResponse.segmentStartTimeMs,
					requestedStartMs: 1001,
					requestedEndMs: 1000,
				}),
			/greater than/,
		);
	});

	it("rejects duration exceeding maxDurationMs", () => {
		assert.throws(
			() =>
				generateHlsPlaylist({
					mpdXml: sampleMpd,
					baseUrl: BASE_URL,
					segmentStartTimeMs: playResponse.segmentStartTimeMs,
					requestedStartMs: TEST_START_MS,
					requestedEndMs: TEST_START_MS + 1000,
					maxDurationMs: 500,
				}),
			/exceeds maximum/,
		);
	});

	it("does not produce MP4 output or copy segments", () => {
		// generateHlsPlaylist is a pure function — it returns only a playlist string.
		// It does not write files, upload to S3, or transcode anything.
		const result = generateHlsPlaylist({
			mpdXml: sampleMpd,
			baseUrl: BASE_URL,
			segmentStartTimeMs: playResponse.segmentStartTimeMs,
			requestedStartMs: TEST_START_MS,
			requestedEndMs: TEST_END_MS,
		});
		assert.equal(
			typeof result.playlist,
			"string",
			"result is a plain string playlist",
		);
		// Playlist references original segment filenames — no upload, no copy
		assert.ok(
			result.playlist.includes(".m4s"),
			"playlist references .m4s segments by name only",
		);
	});
});
