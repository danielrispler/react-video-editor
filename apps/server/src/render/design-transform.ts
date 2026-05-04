import type { RenderRequest } from "../edit-video/edit-video.types.ts";

// Minimal IDesign types mirroring @designcombo/types
interface IDisplay {
	from: number;
	to: number;
}
interface ITrim {
	from: number;
	to: number;
}
interface ISize {
	width: number;
	height: number;
}

interface ITrackItemBase {
	id: string;
	type: string;
	display: IDisplay;
	trim?: ITrim;
	duration?: number;
	details?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

interface ITrack {
	id: string;
	type: string;
	items: string[];
	muted?: boolean;
}

export interface IDesign {
	id: string | number;
	size: ISize;
	duration?: number;
	fps: number;
	tracks: ITrack[];
	trackItemIds: string[];
	trackItemsMap: Record<string, ITrackItemBase>;
}

function parsePx(val: unknown): number {
	if (typeof val === "number") return val;
	if (typeof val === "string") return Number.parseFloat(val) || 0;
	return 0;
}

function toPercent(val: unknown, total: number): number {
	const px = parsePx(val);
	return total > 0 ? Math.min(100, Math.max(0, (px / total) * 100)) : 0;
}

function toOpacity(val: unknown): number | undefined {
	const raw = parsePx(val);
	if (!Number.isFinite(raw)) return undefined;
	if (raw <= 0) return 0;
	if (raw <= 1) return raw;
	return Math.min(1, raw / 100);
}

function parseDegrees(val: unknown): number | undefined {
	if (typeof val === "number" && Number.isFinite(val)) return val;
	if (typeof val !== "string") return undefined;
	const match = /(-?\d+(?:\.\d+)?)deg/.exec(val);
	return match ? Number.parseFloat(match[1] ?? "0") : undefined;
}

function parseRotation(details: Record<string, unknown>): number | undefined {
	const explicitRotate = parseDegrees(details.rotate);
	if (explicitRotate !== undefined) return explicitRotate;

	const transform = details.transform;
	if (typeof transform !== "string") return undefined;
	const rotateMatch = /rotate\(([-\d.]+)deg\)/.exec(transform);
	return rotateMatch ? Number.parseFloat(rotateMatch[1] ?? "0") : undefined;
}

function getSortedTrackItems(
	track: ITrack | undefined,
	trackItemsMap: Record<string, ITrackItemBase>,
): ITrackItemBase[] {
	return (track?.items ?? [])
		.map((id) => trackItemsMap[id])
		.filter((item): item is ITrackItemBase => item !== undefined)
		.sort((a, b) => a.display.from - b.display.from);
}

function getVisualTimelineEnd(
	tracks: ITrack[],
	trackItemsMap: Record<string, ITrackItemBase>,
	designDuration?: number,
): number {
	const itemEnd = tracks
		.filter((track) => track.type !== "audio" && track.type !== "helper")
		.flatMap((track) => track.items)
		.map((itemId) => trackItemsMap[itemId]?.display.to ?? 0)
		.reduce((max, current) => Math.max(max, current), 0);

	return Math.max(itemEnd, designDuration ?? 0) / 1000;
}

export function transformDesignToRenderRequest(
	design: IDesign,
	format: "mp4" = "mp4",
): Omit<RenderRequest, "jobId"> {
	const { tracks, trackItemsMap, size, duration: designDuration } = design;

	const mainTrack =
		tracks.find((t) => t.type === "main") ??
		tracks.find((t) => t.type === "video");
	const audioTracks = tracks.filter((t) => t.type === "audio");
	const mainTrackIndex = mainTrack
		? tracks.findIndex((track) => track.id === mainTrack.id)
		: -1;
	const visualTimelineEnd = getVisualTimelineEnd(
		tracks,
		trackItemsMap,
		designDuration,
	);

	// Build sources from the primary/base track items.
	const mainItems = getSortedTrackItems(mainTrack, trackItemsMap);

	const sources: RenderRequest["sources"] = [];
	let timelinePosition = 0;

	for (const item of mainItems) {
		if (item.type === "text") continue;
		const details = item.details ?? {};
		const url = (details.src as string | undefined) ?? "";
		if (!url) continue;

		const itemFrom = item.display.from / 1000;
		const itemTo = item.display.to / 1000;

		if (itemFrom > timelinePosition + 0.001) {
			sources.push({
				url: `internal://blank?w=${size.width}&h=${size.height}&fps=${design.fps}`,
				type: "video",
				duration: itemFrom - timelinePosition,
			});
		}

		const type = item.type === "image" ? "image" : "video";
		const displayDuration = itemTo - itemFrom;
		const result: RenderRequest["sources"][0] = {
			url,
			type,
			duration: displayDuration,
		};

		if (item.trim !== undefined) {
			result.trimFrom = item.trim.from / 1000;
			result.trimTo = item.trim.to / 1000;
		}

		sources.push(result);
		timelinePosition = itemTo;
	}

	const trimEnd =
		visualTimelineEnd ||
		timelinePosition ||
		(designDuration ? designDuration / 1000 : 5);

	if (timelinePosition < trimEnd - 0.001) {
		sources.push({
			url: `internal://blank?w=${size.width}&h=${size.height}&fps=${design.fps}`,
			type: "video",
			duration: trimEnd - timelinePosition,
		});
	}

	const overlays: RenderRequest["overlays"] = [];
	for (const [trackIndex, track] of tracks.entries()) {
		if (track.type === "audio" || track.type === "helper") continue;

		const trackItems = getSortedTrackItems(track, trackItemsMap);

		for (const item of trackItems) {
			const details = item.details ?? {};
			const start = item.display.from / 1000;
			const end = item.display.to / 1000;
			const isPrimaryTrack = trackIndex === mainTrackIndex;

			if (item.type === "text") {
				const x = toPercent(details.left, size.width);
				const y = toPercent(details.top, size.height);
				const fontSize = details.fontSize as number | undefined;
				const fontColor = details.color as string | undefined;
				const backgroundColor = details.backgroundColor as string | undefined;
				const opacity = toOpacity(details.opacity);
				overlays.push({
					id: item.id,
					type: "text" as const,
					text: (details.text as string | undefined) ?? "",
					start,
					end,
					trackOrder: trackIndex,
					x,
					y,
					...(fontSize !== undefined && { fontSize }),
					...(fontColor !== undefined && { fontColor }),
					...(backgroundColor !== undefined && { backgroundColor }),
					...(opacity !== undefined && { opacity }),
				});
				continue;
			}

			if (item.type === "image" && !isPrimaryTrack) {
				const imageUrl = (details.src as string | undefined) ?? "";
				if (!imageUrl) continue;
				const x = toPercent(details.left, size.width);
				const y = toPercent(details.top, size.height);
				const width = details.width as number | undefined;
				const height = details.height as number | undefined;
				const opacity = toOpacity(details.opacity);
				overlays.push({
					id: item.id,
					type: "image" as const,
					imageUrl,
					start,
					end,
					trackOrder: trackIndex,
					x,
					y,
					...(width !== undefined && { width }),
					...(height !== undefined && { height }),
					...(opacity !== undefined && { opacity }),
				});
				continue;
			}

			if (!isPrimaryTrack && item.type === "video") {
				const sourceUrl = (details.src as string | undefined) ?? "";
				if (!sourceUrl) continue;
				const width = details.width as number | undefined;
				const height = details.height as number | undefined;
				const crop = details.crop;
				const opacity = toOpacity(details.opacity);
				const rotation = parseRotation(details);
				overlays.push({
					id: item.id,
					type: "video" as const,
					sourceUrl,
					start,
					end,
					trackOrder: trackIndex,
					left: parsePx(details.left),
					top: parsePx(details.top),
					...(width !== undefined && { width }),
					...(height !== undefined && { height }),
					...(item.trim !== undefined && {
						trimFrom: item.trim.from / 1000,
						trimTo: item.trim.to / 1000,
					}),
					...(opacity !== undefined && { opacity }),
					...(typeof details.transform === "string" && {
						transform: details.transform,
					}),
					...(crop !== undefined &&
						typeof crop === "object" &&
						crop !== null && {
							crop: {
								x: parsePx((crop as Record<string, unknown>).x),
								y: parsePx((crop as Record<string, unknown>).y),
								width: Math.max(
									1,
									parsePx((crop as Record<string, unknown>).width) ||
										width ||
										size.width,
								),
								height: Math.max(
									1,
									parsePx((crop as Record<string, unknown>).height) ||
										height ||
										size.height,
								),
							},
						}),
					...(details.blur !== undefined && { blur: parsePx(details.blur) }),
					...(details.brightness !== undefined && {
						brightness: parsePx(details.brightness),
					}),
					...(details.borderRadius !== undefined && {
						borderRadius: parsePx(details.borderRadius),
					}),
					...(rotation !== undefined && { rotation }),
				});
			}
		}
	}

	// Build audio sources
	const audioSources: RenderRequest["audioSources"] = [];
	for (const track of audioTracks) {
		for (const itemId of track.items) {
			const item = trackItemsMap[itemId];
			if (!item) continue;
			const details = item.details ?? {};
			const src = (details.src as string | undefined) ?? "";
			if (!src) continue;
			const startTime = item.display.from / 1000;
			const displayDuration = (item.display.to - item.display.from) / 1000;
			const trimDuration = item.trim
				? (item.trim.to - item.trim.from) / 1000
				: displayDuration;
			const originalDuration =
				item.duration !== undefined ? item.duration / 1000 : undefined;
			const audioTrimStart = item.trim ? item.trim.from / 1000 : undefined;
			const audioTrimEnd = item.trim ? item.trim.to / 1000 : undefined;
			audioSources.push({
				url: src,
				startTime,
				duration: trimDuration,
				...(originalDuration !== undefined && { originalDuration }),
				...(audioTrimStart !== undefined && { audioTrimStart }),
				...(audioTrimEnd !== undefined && { audioTrimEnd }),
				volume: (details.volume as number | undefined) ?? 1,
				muted: track.muted === true,
				solo: false,
			});
		}
	}

	return {
		sources:
			sources.length > 0
				? sources
				: [
						{
							url: `internal://blank?w=${size.width}&h=${size.height}&fps=${design.fps}`,
							type: "video",
							duration: trimEnd || 5,
						},
					],
		trimEnd,
		cuts: [],
		overlays,
		audioSources,
		audioMixMode: "mix",
		format,
	};
}
