import { readFileSync } from "node:fs";
import path from "node:path";

export const DEMO_PREVIEW_CHANNEL_ID = "demo-recording";
export const DEMO_PREVIEW_SEGMENT_START_MS = 1778412270000;
export const DEMO_PREVIEW_TOTAL_DURATION_MS = 30000;
export const DEMO_PREVIEW_DEFAULT_START_MS =
	DEMO_PREVIEW_SEGMENT_START_MS + 6333;
export const DEMO_PREVIEW_DEFAULT_END_MS =
	DEMO_PREVIEW_SEGMENT_START_MS + 25000;

const demoAssetsDir = path.join(
	import.meta.dirname,
	"../sources/__fixtures__/hls-preview/demo-dash",
);

export const getDemoPreviewAssetsDir = (): string => demoAssetsDir;

export const loadDemoPreviewFixture = (
	serverBaseUrl: string,
): {
	mpdXml: string;
	baseUrl: string;
	segmentStartTimeMs: number;
	endTimeMs: number;
} => ({
	mpdXml: readFileSync(path.join(demoAssetsDir, "stream.mpd"), "utf-8"),
	baseUrl: `${serverBaseUrl}/api/editor/demo-assets`,
	segmentStartTimeMs: DEMO_PREVIEW_SEGMENT_START_MS,
	endTimeMs: DEMO_PREVIEW_SEGMENT_START_MS + DEMO_PREVIEW_TOTAL_DURATION_MS,
});
