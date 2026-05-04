import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Overlay } from "../../edit-video/edit-video.types.ts";
import {
	type PreparedOverlayInput,
	buildOverlayFilters,
	sortOverlaysByRenderOrder,
} from "./overlay.service.ts";

describe("overlay.service", () => {
	it("sorts overlays by track order before building filters", () => {
		const overlays: Overlay[] = [
			{
				id: "video-overlay",
				type: "video",
				sourceUrl: "https://example.com/video.mp4",
				start: 2,
				end: 6,
				trackOrder: 2,
				left: 10,
				top: 20,
				width: 100,
				height: 80,
				trimFrom: 1,
				trimTo: 5,
				opacity: 0.75,
				transform: "scale(1.5)",
				crop: {
					x: 5,
					y: 10,
					width: 60,
					height: 40,
				},
				blur: 4,
				brightness: 120,
				borderRadius: 10,
				rotation: 15,
			},
			{
				id: "image-overlay",
				type: "image",
				imageUrl: "https://example.com/image.png",
				start: 1,
				end: 4,
				trackOrder: 1,
				x: 5,
				y: 10,
				width: 200,
				height: 100,
			},
		];

		const sorted = sortOverlaysByRenderOrder(overlays);
		const overlayInputs: PreparedOverlayInput[] = [
			{
				overlayId: "image-overlay",
				overlayType: "image",
				path: "/tmp/image.png",
			},
			{
				overlayId: "video-overlay",
				overlayType: "video",
				path: "/tmp/video.mp4",
			},
		];

		const result = buildOverlayFilters(overlays, overlayInputs, 8);

		assert.deepEqual(
			sorted.map((overlay) => overlay.id),
			["image-overlay", "video-overlay"],
		);
		assert.match(result.filterComplex, /\[1:v\]loop=loop=-1:size=240:start=0/);
		assert.match(
			result.filterComplex,
			/\[2:v\]trim=duration=4,/,
		);
		assert.match(
			result.filterComplex,
			/setpts=PTS-STARTPTS\+2\/TB,format=rgba\[videoOverlay2\]/,
		);
		assert.match(result.filterComplex, /enable='between\(t,2,6\)'/);
		assert.match(
			result.filterComplex,
			/overlay=x='40-overlay_w\/2':y='40-overlay_h\/2'/,
		);
		assert.equal(result.outputStream, "v2");
	});
});
