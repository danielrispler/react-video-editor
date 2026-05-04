import type { EnvConfig } from "../../config/env.ts";
import type { Overlay } from "../../edit-video/edit-video.types.ts";
import { OverlayType } from "../../types/types.ts";
import type { StorageProvider } from "../storage/storage.types.ts";
import {
	buildCircleOverlayFilter,
	prepareCircleOverlay,
} from "./circle-overlay.service.ts";
import {
	buildImageOverlayFilter,
	prepareImageOverlay,
} from "./image-overlay.service.ts";
import { buildRectangleOverlayFilter } from "./rectangle-overlay.service.ts";
import { buildTextOverlayFilter } from "./text-overlay.service.ts";
import {
	buildVideoOverlayFilter,
	prepareVideoOverlay,
} from "./video-overlay.service.ts";

export interface PreparedOverlayInput {
	overlayId: string;
	overlayType: Overlay["type"];
	path: string;
}

interface OverlayFilterResult {
	filterPart: string;
	outputStream: string;
}

const buildOverlayInputIndexMap = (
	overlayInputs: PreparedOverlayInput[],
): Map<string, number> => {
	return new Map(
		overlayInputs.map((input, index) => [input.overlayId, index + 1]),
	);
};

const buildOverlayFilter = (
	overlay: Overlay,
	currentStream: string,
	filterIndex: number,
	overlayInputIndexes: Map<string, number>,
	videoDuration: number,
): OverlayFilterResult | null => {
	const outputLabel = `v${filterIndex + 1}`;

	if (overlay.type === OverlayType.text) {
		return {
			filterPart: buildTextOverlayFilter(overlay, currentStream, outputLabel),
			outputStream: `[${outputLabel}]`,
		};
	}

	if (overlay.type === OverlayType.image) {
		const inputIndex = overlayInputIndexes.get(overlay.id);
		if (inputIndex === undefined) return null;
		return {
			filterPart: buildImageOverlayFilter(
				overlay,
				inputIndex,
				currentStream,
				outputLabel,
				videoDuration,
			),
			outputStream: `[${outputLabel}]`,
		};
	}

	if (overlay.type === OverlayType.circle) {
		const inputIndex = overlayInputIndexes.get(overlay.id);
		if (inputIndex === undefined) return null;
		return {
			filterPart: buildCircleOverlayFilter(
				overlay,
				inputIndex,
				currentStream,
				outputLabel,
			),
			outputStream: `[${outputLabel}]`,
		};
	}

	if (overlay.type === OverlayType.video) {
		const inputIndex = overlayInputIndexes.get(overlay.id);
		if (inputIndex === undefined) return null;
		return {
			filterPart: buildVideoOverlayFilter(
				overlay,
				inputIndex,
				currentStream,
				outputLabel,
			),
			outputStream: `[${outputLabel}]`,
		};
	}

	if (overlay.type === OverlayType.rectangle) {
		return {
			filterPart: buildRectangleOverlayFilter(
				overlay,
				currentStream,
				outputLabel,
			),
			outputStream: `[${outputLabel}]`,
		};
	}

	return null;
};

export const sortOverlaysByRenderOrder = (overlays: Overlay[]): Overlay[] => {
	return overlays
		.map((overlay, index) => ({ overlay, index }))
		.sort((a, b) => {
			const trackOrderA =
				"trackOrder" in a.overlay && typeof a.overlay.trackOrder === "number"
					? a.overlay.trackOrder
					: 0;
			const trackOrderB =
				"trackOrder" in b.overlay && typeof b.overlay.trackOrder === "number"
					? b.overlay.trackOrder
					: 0;

			// Reverse sort: process higher track numbers first, lower track numbers last.
			// This ensures elements on track 0 (like captions) are drawn last and appear on top.
			return trackOrderB - trackOrderA || a.index - b.index;
		})
		.map(({ overlay }) => overlay);
};

export const prepareOverlays = async (
	overlays: Overlay[],
	tempDir: string,
	storage: StorageProvider,
	config: EnvConfig,
): Promise<{ overlayInputs: PreparedOverlayInput[]; hasOverlays: boolean }> => {
	const overlayInputs: PreparedOverlayInput[] = [];

	for (const overlay of sortOverlaysByRenderOrder(overlays)) {
		if (overlay.type === OverlayType.image) {
			overlayInputs.push({
				overlayId: overlay.id,
				overlayType: overlay.type,
				path: await prepareImageOverlay(overlay, tempDir),
			});
		} else if (overlay.type === OverlayType.circle) {
			overlayInputs.push({
				overlayId: overlay.id,
				overlayType: overlay.type,
				path: await prepareCircleOverlay(overlay, tempDir),
			});
		} else if (overlay.type === OverlayType.video) {
			overlayInputs.push({
				overlayId: overlay.id,
				overlayType: overlay.type,
				path: await prepareVideoOverlay(overlay, tempDir, storage, config),
			});
		}
	}

	return {
		overlayInputs,
		hasOverlays: overlays.length > 0,
	};
};

export const buildOverlayFilters = (
	overlays: Overlay[],
	overlayInputs: PreparedOverlayInput[],
	videoDuration: number,
): { filterComplex: string; outputStream: string } => {
	if (overlays.length === 0) {
		return { filterComplex: "", outputStream: "" };
	}

	const sortedOverlays = sortOverlaysByRenderOrder(overlays);
	const overlayInputIndexes = buildOverlayInputIndexMap(overlayInputs);

	const result = sortedOverlays.reduce<{
		filterParts: string[];
		currentStream: string;
	}>(
		(acc, overlay) => {
			const filterResult = buildOverlayFilter(
				overlay,
				acc.currentStream,
				acc.filterParts.length,
				overlayInputIndexes,
				videoDuration,
			);

			if (!filterResult) {
				return acc;
			}

			return {
				filterParts: [...acc.filterParts, filterResult.filterPart],
				currentStream: filterResult.outputStream,
			};
		},
		{
			filterParts: [],
			currentStream: "[0:v]",
		},
	);

	const finalOutputStream = result.currentStream.replace(/^\[|\]$/g, "");
	console.log(
		`[buildOverlayFilters] Final output stream: ${finalOutputStream}, filter parts: ${result.filterParts.length}`,
	);

	return {
		filterComplex: result.filterParts.join(";"),
		outputStream: finalOutputStream,
	};
};
