import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IDesign } from "./design-transform.ts";
import { transformDesignToRenderRequest } from "./design-transform.ts";

const baseDetails = {
	width: 1920,
	height: 1080,
	left: "0px",
	top: "0px",
	opacity: 100,
	transform: "none",
	blur: 0,
	brightness: 100,
	borderRadius: 0,
	rotate: "0deg",
};

const createVideoItem = (
	id: string,
	src: string,
	from: number,
	to: number,
	details: Record<string, unknown> = {},
) => ({
	id,
	type: "video",
	display: { from, to },
	trim: { from: 0, to: to - from },
	details: {
		...baseDetails,
		src,
		...details,
	},
});

const createAudioItem = (
	id: string,
	src: string,
	from: number,
	to: number,
) => ({
	id,
	type: "audio",
	display: { from, to },
	trim: { from: 0, to: to - from },
	details: {
		src,
		volume: 1,
	},
});

describe("transformDesignToRenderRequest", () => {
	it("keeps single-row exports in sources and emits no video overlays", () => {
		const design: IDesign = {
			id: "design-single-row",
			fps: 30,
			duration: 5000,
			size: { width: 1920, height: 1080 },
			tracks: [{ id: "track-base", type: "video", items: ["clip-base"] }],
			trackItemIds: ["clip-base"],
			trackItemsMap: {
				"clip-base": createVideoItem(
					"clip-base",
					"https://example.com/base.mp4",
					0,
					5000,
				),
			},
		};

		const request = transformDesignToRenderRequest(design);

		assert.equal(request.sources.length, 1);
		assert.equal(request.sources[0]?.url, "https://example.com/base.mp4");
		assert.equal(request.sources[0]?.trimTo, 5);
		assert.deepEqual(
			request.overlays.filter((overlay) => overlay.type === "video"),
			[],
		);
	});

	it("switches multi-row video exports to composited overlays on a blank base", () => {
		const design: IDesign = {
			id: "design-stacked-rows",
			fps: 30,
			duration: 15000,
			size: { width: 1920, height: 1080 },
			tracks: [
				{ id: "track-base", type: "video", items: ["base-middle"] },
				{
					id: "track-overlay",
					type: "video",
					items: ["overlay-early", "overlay-late"],
				},
			],
			trackItemIds: ["base-middle", "overlay-early", "overlay-late"],
			trackItemsMap: {
				"base-middle": createVideoItem(
					"base-middle",
					"https://example.com/base-middle.mp4",
					5000,
					10000,
				),
				"overlay-early": createVideoItem(
					"overlay-early",
					"https://example.com/overlay-early.mp4",
					0,
					5000,
					{
						left: "120px",
						top: "80px",
						width: 640,
						height: 360,
						transform: "scale(1.25)",
						borderRadius: 12,
						brightness: 110,
						blur: 4,
					},
				),
				"overlay-late": createVideoItem(
					"overlay-late",
					"https://example.com/overlay-late.mp4",
					10000,
					15000,
					{
						left: "200px",
						top: "160px",
						width: 480,
						height: 270,
					},
				),
			},
		};

		const request = transformDesignToRenderRequest(design);
		const videoOverlays = request.overlays.filter(
			(overlay) => overlay.type === "video",
		);

		assert.equal(request.trimEnd, 15);
		assert.equal(request.sources.length, 1);
		assert.equal(request.sources[0]?.url.startsWith("internal://blank"), true);
		assert.equal(request.sources[0]?.duration, 15);
		assert.equal(videoOverlays.length, 3);
		assert.deepEqual(
			videoOverlays.map((overlay) => overlay.id),
			["base-middle", "overlay-early", "overlay-late"],
		);
		assert.equal(videoOverlays[0]?.trackOrder, 0);
		assert.equal(
			videoOverlays[1]?.sourceUrl,
			"https://example.com/overlay-early.mp4",
		);
		assert.equal(videoOverlays[1]?.trackOrder, 1);
		assert.equal(videoOverlays[1]?.left, 120);
		assert.equal(videoOverlays[1]?.opacity, 1);
		assert.deepEqual(
			request.audioSources.map((source) => ({
				url: source.url,
				startTime: source.startTime,
				duration: source.duration,
			})),
			[
				{
					url: "https://example.com/base-middle.mp4",
					startTime: 5,
					duration: 5,
				},
			],
		);
	});

	it("orders overlapping stacked clips by track order and keeps explicit audio tracks separate", () => {
		const design: IDesign = {
			id: "design-overlap-order",
			fps: 30,
			duration: 8000,
			size: { width: 1920, height: 1080 },
			tracks: [
				{ id: "track-base", type: "video", items: ["base"] },
				{ id: "track-row-2", type: "video", items: ["overlay-row-2"] },
				{ id: "track-row-3", type: "video", items: ["overlay-row-3"] },
				{ id: "track-audio", type: "audio", items: ["audio-bed"] },
			],
			trackItemIds: ["base", "overlay-row-2", "overlay-row-3", "audio-bed"],
			trackItemsMap: {
				base: createVideoItem("base", "https://example.com/base.mp4", 0, 8000),
				"overlay-row-2": createVideoItem(
					"overlay-row-2",
					"https://example.com/overlay-row-2.mp4",
					2000,
					6000,
				),
				"overlay-row-3": createVideoItem(
					"overlay-row-3",
					"https://example.com/overlay-row-3.mp4",
					2500,
					5500,
				),
				"audio-bed": createAudioItem(
					"audio-bed",
					"https://example.com/audio-bed.mp3",
					0,
					8000,
				),
			},
		};

		const request = transformDesignToRenderRequest(design);
		const videoOverlays = request.overlays.filter(
			(overlay) => overlay.type === "video",
		);

		assert.deepEqual(
			videoOverlays.map((overlay) => ({
				id: overlay.id,
				trackOrder: overlay.trackOrder,
			})),
			[
				{ id: "base", trackOrder: 0 },
				{ id: "overlay-row-2", trackOrder: 1 },
				{ id: "overlay-row-3", trackOrder: 2 },
			],
		);
		assert.deepEqual(
			request.audioSources.map((source) => source.url),
			["https://example.com/base.mp4", "https://example.com/audio-bed.mp3"],
		);
		assert.deepEqual(
			request.audioSources.map((source) => source.volume),
			[1, 1],
		);
	});

	it("normalizes timeline audio volume percentages and adds a fallback text stroke", () => {
		const design: IDesign = {
			id: "design-audio-and-text",
			fps: 30,
			duration: 5000,
			size: { width: 1080, height: 1920 },
			tracks: [
				{ id: "track-base", type: "video", items: ["base"] },
				{ id: "track-text", type: "text", items: ["title"] },
				{ id: "track-audio", type: "audio", items: ["audio-bed"] },
			],
			trackItemIds: ["base", "title", "audio-bed"],
			trackItemsMap: {
				base: createVideoItem("base", "https://example.com/base.mp4", 0, 5000),
				title: {
					id: "title",
					type: "text",
					display: { from: 0, to: 5000 },
					details: {
						text: "שלום עולם",
						fontSize: 120,
						left: "240px",
						top: "700px",
						color: "#ffffff",
						backgroundColor: "transparent",
						boxShadow: { x: 0, y: 0, blur: 0, color: "#ffffff" },
					},
				},
				"audio-bed": {
					...createAudioItem(
						"audio-bed",
						"https://example.com/audio-bed.mp3",
						0,
						5000,
					),
					details: {
						src: "https://example.com/audio-bed.mp3",
						volume: 100,
					},
				},
			},
		};

		const request = transformDesignToRenderRequest(design);
		const textOverlay = request.overlays.find(
			(overlay) => overlay.type === "text",
		);

		assert.equal(request.audioSources[1]?.volume, 1);
		assert.equal(textOverlay?.type, "text");
		assert.equal(textOverlay?.strokeWidth, 7);
		assert.equal(textOverlay?.strokeColor, "#000000");
		assert.equal(textOverlay?.textAlign, "left");
	});

	it("preserves text box dimensions and center alignment for export layout", () => {
		const design: IDesign = {
			id: "design-centered-text",
			fps: 30,
			duration: 5000,
			size: { width: 1080, height: 1920 },
			tracks: [
				{ id: "track-base", type: "video", items: ["base"] },
				{ id: "track-text", type: "text", items: ["title"] },
			],
			trackItemIds: ["base", "title"],
			trackItemsMap: {
				base: createVideoItem("base", "https://example.com/base.mp4", 0, 5000),
				title: {
					id: "title",
					type: "text",
					display: { from: 0, to: 5000 },
					details: {
						text: "בדיקה לרוני",
						fontSize: 120,
						left: "240px",
						top: "700px",
						width: 600,
						height: 300,
						textAlign: "center",
						color: "#ffffff",
						backgroundColor: "transparent",
					},
				},
			},
		};

		const request = transformDesignToRenderRequest(design);
		const textOverlay = request.overlays.find(
			(overlay) => overlay.type === "text",
		);

		assert.equal(textOverlay?.type, "text");
		assert.equal(textOverlay?.elementWidth, 600);
		assert.equal(textOverlay?.elementHeight, 300);
		assert.equal(textOverlay?.textAlign, "center");
	});

	it("composites a scene-adjusted single-row video instead of exporting raw source dimensions", () => {
		const design: IDesign = {
			id: "design-single-row-adjusted",
			fps: 30,
			duration: 5000,
			size: { width: 1920, height: 1080 },
			tracks: [{ id: "track-base", type: "video", items: ["clip-base"] }],
			trackItemIds: ["clip-base"],
			trackItemsMap: {
				"clip-base": createVideoItem(
					"clip-base",
					"https://example.com/base.mp4",
					0,
					5000,
					{
						left: "320px",
						top: "180px",
						width: 1280,
						height: 720,
					},
				),
			},
		};

		const request = transformDesignToRenderRequest(design);
		const videoOverlays = request.overlays.filter(
			(overlay) => overlay.type === "video",
		);

		assert.equal(request.sources.length, 1);
		assert.equal(request.sources[0]?.url.startsWith("internal://blank"), true);
		assert.equal(videoOverlays.length, 1);
		assert.equal(videoOverlays[0]?.left, 320);
		assert.equal(videoOverlays[0]?.width, 1280);
		assert.deepEqual(
			request.audioSources.map((source) => source.url),
			["https://example.com/base.mp4"],
		);
	});

	it("preserves webp as the requested export format", () => {
		const design: IDesign = {
			id: "design-webp",
			fps: 30,
			duration: 3000,
			size: { width: 1920, height: 1080 },
			tracks: [{ id: "track-base", type: "video", items: ["clip-base"] }],
			trackItemIds: ["clip-base"],
			trackItemsMap: {
				"clip-base": createVideoItem(
					"clip-base",
					"https://example.com/base.mp4",
					0,
					3000,
				),
			},
		};

		const request = transformDesignToRenderRequest(design, "webp");

		assert.equal(request.format, "webp");
	});
});
