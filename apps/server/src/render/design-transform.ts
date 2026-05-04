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

function normalizeVolume(val: unknown): number {
	const raw = parsePx(val);
	if (!Number.isFinite(raw)) return 1;
	if (raw <= 0) return 0;
	if (raw <= 1) return raw;
	return Math.min(1, raw / 100);
}

function isTransparentBackground(backgroundColor: unknown): boolean {
	if (typeof backgroundColor !== "string") return true;
	const normalized = backgroundColor.trim().toLowerCase();
	return (
		normalized === "" ||
		normalized === "transparent" ||
		normalized === "none" ||
		normalized === "rgba(0,0,0,0)" ||
		normalized === "rgba(0, 0, 0, 0)"
	);
}

function isLightColor(color: unknown): boolean {
	if (typeof color !== "string") return true;
	const normalized = color.trim();
	if (!normalized.startsWith("#")) {
		return normalized.toLowerCase() !== "black";
	}

	const hex = normalized.slice(1);
	const expanded =
		hex.length === 3
			? hex
					.split("")
					.map((char) => `${char}${char}`)
					.join("")
			: hex;

	if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return true;

	const r = Number.parseInt(expanded.slice(0, 2), 16);
	const g = Number.parseInt(expanded.slice(2, 4), 16);
	const b = Number.parseInt(expanded.slice(4, 6), 16);
	const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	return luminance >= 0.5;
}

function getReadableStroke(details: Record<string, unknown>): {
	strokeWidth?: number;
	strokeColor?: string;
} {
	const explicitStrokeWidth = parsePx(
		details.WebkitTextStrokeWidth ?? details.borderWidth,
	);
	const explicitStrokeColor =
		(details.WebkitTextStrokeColor as string | undefined) ??
		(details.borderColor as string | undefined);

	if (explicitStrokeWidth > 0) {
		return {
			strokeWidth: explicitStrokeWidth,
			strokeColor: explicitStrokeColor ?? "#000000",
		};
	}

	const fontSize = parsePx(details.fontSize);
	const shouldAddFallbackStroke =
		fontSize >= 48 &&
		isTransparentBackground(details.backgroundColor) &&
		parsePx(
			details.boxShadow && typeof details.boxShadow === "object"
				? (details.boxShadow as Record<string, unknown>).blur
				: 0,
		) === 0;

	if (!shouldAddFallbackStroke) {
		return {};
	}

	return {
		strokeWidth: Math.max(2, Math.round(fontSize / 18)),
		strokeColor: isLightColor(details.color) ? "#000000" : "#ffffff",
	};
}

function parseDegrees(val: unknown): number | undefined {
	if (typeof val === "number" && Number.isFinite(val)) return val;
	if (typeof val !== "string") return undefined;
	const match = /(-?\d+(?:\.\d+)?)deg/.exec(val);
	return match ? Number.parseFloat(match[1] ?? "0") : undefined;
}

function parseScale(transform?: unknown): { scaleX: number; scaleY: number } {
	if (typeof transform !== "string" || transform === "none") return { scaleX: 1, scaleY: 1 };

	const scaleMatch = /scale\(([^)]+)\)/.exec(transform);
	if (!scaleMatch) return { scaleX: 1, scaleY: 1 };

	const values =
		scaleMatch[1]
			?.split(",")
			.map((value) => Number.parseFloat(value.trim()))
			.filter((value) => Number.isFinite(value)) ?? [];

	if (values.length === 0) return { scaleX: 1, scaleY: 1 };
	if (values.length === 1)
		return { scaleX: values[0] ?? 1, scaleY: values[0] ?? 1 };

	return {
		scaleX: values[0] ?? 1,
		scaleY: values[1] ?? 1,
	};
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

function getTimelineEnd(
	tracks: ITrack[],
	trackItemsMap: Record<string, ITrackItemBase>,
	designDuration?: number,
): number {
	const itemEnd = tracks
		.filter((track) => track.type !== "helper")
		.flatMap((track) => track.items)
		.map((itemId) => trackItemsMap[itemId]?.display.to ?? 0)
		.reduce((max, current) => Math.max(max, current), 0);

	return Math.max(itemEnd, designDuration ?? 0) / 1000;
}

function getVideoTracks(tracks: ITrack[]): ITrack[] {
	return tracks.filter(
		(track) => track.type === "main" || track.type === "video",
	);
}

function isSceneAdjustedVisual(item: ITrackItemBase, size: ISize): boolean {
	const details = item.details ?? {};
	const width = parsePx(details.width);
	const height = parsePx(details.height);
	const left = parsePx(details.left);
	const top = parsePx(details.top);
	const opacity = parsePx(details.opacity || 100);
	const blur = parsePx(details.blur);
	const brightness =
		details.brightness === undefined ? 100 : parsePx(details.brightness);
	const borderRadius = parsePx(details.borderRadius);
	const rotation = parseRotation(details) ?? 0;
	const transform =
		typeof details.transform === "string" ? details.transform.trim() : "none";
	const crop =
		typeof details.crop === "object" && details.crop !== null
			? (details.crop as Record<string, unknown>)
			: undefined;

	return (
		left !== 0 ||
		top !== 0 ||
		(width > 0 && Math.abs(width - size.width) > 0.5) ||
		(height > 0 && Math.abs(height - size.height) > 0.5) ||
		opacity !== 100 ||
		blur > 0 ||
		brightness !== 100 ||
		borderRadius > 0 ||
		rotation !== 0 ||
		(transform !== "" && transform !== "none") ||
		crop !== undefined
	);
}

export function transformDesignToRenderRequest(
	design: IDesign,
	format: "mp4" | "webp" = "mp4",
): Omit<RenderRequest, "jobId"> {
	const { tracks, trackItemsMap, size, duration: designDuration } = design;

	const videoTracks = getVideoTracks(tracks);
	const mainTrack =
		tracks.find((t) => t.type === "main") ??
		tracks.find((t) => t.type === "video");
	const audioTracks = tracks.filter((t) => t.type === "audio");
	const mainTrackIndex = mainTrack
		? tracks.findIndex((track) => track.id === mainTrack.id)
		: -1;
	const timelineEnd = getTimelineEnd(
		tracks,
		trackItemsMap,
		designDuration,
	);

	// Build sources from the primary/base track items.
	const mainItems = getSortedTrackItems(mainTrack, trackItemsMap);
	const shouldCompositeVideoRows =
		videoTracks.length > 1 ||
		mainItems.some(
			(item) => item.type === "video" && isSceneAdjustedVisual(item, size),
		);

	const sources: RenderRequest["sources"] = [];
	let timelinePosition = 0;

	if (shouldCompositeVideoRows) {
		const baseDuration =
			timelineEnd || (designDuration ? designDuration / 1000 : 5);
		sources.push({
			url: `internal://blank?w=${size.width}&h=${size.height}&fps=${design.fps}`,
			type: "video",
			duration: baseDuration,
		});
		timelinePosition = baseDuration;
	} else {
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
	}

	const trimEnd =
		timelineEnd ||
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
	// Bounding box calculation to crop redundant black areas.
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	const updateBoundingBoxScaled = (
		left: number,
		top: number,
		width: number,
		height: number,
		transform?: unknown,
	) => {
		if (width <= 0 || height <= 0) return;
		const { scaleX, scaleY } = parseScale(transform);
		const actualWidth = width * Math.abs(scaleX);
		const actualHeight = height * Math.abs(scaleY);
		
		// The center remains the same: center_x = left + width/2
		// new_left = center_x - actualWidth/2
		const actualLeft = left + width / 2 - actualWidth / 2;
		const actualTop = top + height / 2 - actualHeight / 2;

		if (actualLeft < minX) minX = actualLeft;
		if (actualTop < minY) minY = actualTop;
		if (actualLeft + actualWidth > maxX) maxX = actualLeft + actualWidth;
		if (actualTop + actualHeight > maxY) maxY = actualTop + actualHeight;
	};

	for (const [trackIndex, track] of tracks.entries()) {
		if (track.type === "audio" || track.type === "helper") continue;

		const trackItems = getSortedTrackItems(track, trackItemsMap);

		for (const item of trackItems) {
			const details = item.details ?? {};
			const start = item.display.from / 1000;
			const end = item.display.to / 1000;
			const isPrimaryTrack = trackIndex === mainTrackIndex;
			
			const left = parsePx(details.left);
			const top = parsePx(details.top);
			const width = parsePx(details.width);
			const height = parsePx(details.height);

			if (item.type === "text") {
				updateBoundingBoxScaled(left, top, width, height, details.transform);
				
				const x = toPercent(left, size.width);
				const y = toPercent(top, size.height);
				const rawFontSize = parsePx(details.fontSize);
				const fontSize = rawFontSize > 0 ? rawFontSize : undefined;
				const rawElementWidth = width;
				const elementWidth =
					rawElementWidth > 0 ? rawElementWidth : undefined;
				const fontColor = details.color as string | undefined;
				const backgroundColor = details.backgroundColor as
					| string
					| undefined;
				const opacity = toOpacity(details.opacity);
				const { strokeWidth, strokeColor } = getReadableStroke(details);
				overlays.push({
					id: item.id,
					type: "text" as const,
					text: (details.text as string | undefined) ?? "",
					start,
					end,
					trackOrder: trackIndex,
					x,
					y,
					canvasHeight: size.height,
					canvasWidth: size.width,
					...(elementWidth !== undefined && { elementWidth }),
					...(fontSize !== undefined && { fontSize }),
					...(fontColor !== undefined && { fontColor }),
					...(backgroundColor !== undefined && { backgroundColor }),
					...(strokeWidth !== undefined && { strokeWidth }),
					...(strokeColor !== undefined && { strokeColor }),
					...(opacity !== undefined && { opacity }),
				});
				continue;
			}

			if (item.type === "image") {
				updateBoundingBoxScaled(left, top, width, height, details.transform);

				if (!isPrimaryTrack || shouldCompositeVideoRows) {
					const imageUrl = (details.src as string | undefined) ?? "";
					if (!imageUrl) continue;
					
					const x = toPercent(left, size.width);
					const y = toPercent(top, size.height);
					const widthOpt = width || undefined;
					const heightOpt = height || undefined;
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
						...(widthOpt !== undefined && { width: widthOpt }),
						...(heightOpt !== undefined && { height: heightOpt }),
						...(opacity !== undefined && { opacity }),
					});
				}
				continue;
			}

			if (item.type === "video") {
				updateBoundingBoxScaled(left, top, width, height, details.transform);
				
				if (!isPrimaryTrack || shouldCompositeVideoRows) {
					const sourceUrl = (details.src as string | undefined) ?? "";
					if (!sourceUrl) continue;

					const widthOpt = width || undefined;
					const heightOpt = height || undefined;
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
						left: left,
						top: top,
						...(widthOpt !== undefined && { width: widthOpt }),
						...(heightOpt !== undefined && { height: heightOpt }),
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
	}

	// Build audio sources
	const audioSources: RenderRequest["audioSources"] = [];
	if (shouldCompositeVideoRows && mainTrack && mainTrack.muted !== true) {
		for (const item of mainItems) {
			if (item.type !== "video") continue;
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
				sourceType: "video",
				volume: normalizeVolume(
					details.volume === undefined ? 100 : details.volume,
				),
				muted: false,
				solo: false,
			});
		}
	}

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
				sourceType: "audio",
				volume: normalizeVolume(details.volume),
				muted: track.muted === true,
				solo: false,
			});
		}
	}

	const cropRegion =
		minX < Number.POSITIVE_INFINITY &&
		maxX > Number.NEGATIVE_INFINITY &&
		minY < Number.POSITIVE_INFINITY &&
		maxY > Number.NEGATIVE_INFINITY
			? {
					x: Math.max(0, Math.round(minX)),
					y: Math.max(0, Math.round(minY)),
					width: Math.min(size.width, Math.round(maxX - minX)),
					height: Math.min(size.height, Math.round(maxY - minY)),
				}
			: undefined;

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
		...(cropRegion &&
			cropRegion.width > 0 &&
			cropRegion.height > 0 && { cropRegion }),
	};
}
