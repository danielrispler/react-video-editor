import type { Overlay } from '../../edit-video/edit-video.types.ts';
import { OverlayType } from '../../types/types.ts';
import { buildTextOverlayFilter } from './text-overlay.service.ts';
import { buildImageOverlayFilter, prepareImageOverlays } from './image-overlay.service.ts';
import { buildCircleOverlayFilter } from './circle-overlay.service.ts';
import { buildRectangleOverlayFilter } from './rectangle-overlay.service.ts';

interface OverlayFilterResult {
    filterPart: string;
    outputStream: string;
    imageInputIndex?: number;
}

const buildOverlayFilter = (overlay: Overlay, currentStream: string, filterIndex: number, imageInputIndex: number, imagePaths: string[], videoDuration: number): OverlayFilterResult | null => {
    const outputLabel = `v${filterIndex + 1}`;

    if (overlay.type === OverlayType.text) {
        return {
            filterPart: buildTextOverlayFilter(overlay, currentStream, outputLabel),
            outputStream: `[${outputLabel}]`
        };
    }

    if (overlay.type === OverlayType.image && imageInputIndex - 1 < imagePaths.length) {
        return {
            filterPart: buildImageOverlayFilter(overlay, imageInputIndex, currentStream, outputLabel, videoDuration),
            outputStream: `[${outputLabel}]`,
            imageInputIndex: imageInputIndex + 1
        };
    }

    if (overlay.type === OverlayType.circle && imageInputIndex - 1 < imagePaths.length) {
        return {
            filterPart: buildCircleOverlayFilter(overlay, imageInputIndex, currentStream, outputLabel),
            outputStream: `[${outputLabel}]`,
            imageInputIndex: imageInputIndex + 1
        };
    }

    if (overlay.type === OverlayType.rectangle) {
        return {
            filterPart: buildRectangleOverlayFilter(overlay, currentStream, outputLabel),
            outputStream: `[${outputLabel}]`
        };
    }

    return null;
};

const sortOverlaysByStart = (overlays: Overlay[]): Overlay[] => {
    return [...overlays].sort((a, b) => a.start - b.start);
};

export const prepareOverlays = prepareImageOverlays;

export const buildOverlayFilters = (
    overlays: Overlay[],
    imagePaths: string[],
    videoDuration: number
): { filterComplex: string; outputStream: string } => {
    if (overlays.length === 0) {
        return { filterComplex: '', outputStream: '' };
    }

    const sortedOverlays = sortOverlaysByStart(overlays);

    const result = sortedOverlays.reduce<{
        filterParts: string[];
        currentStream: string;
        imageInputIndex: number;
    }>(
        (acc, overlay) => {
            const filterResult = buildOverlayFilter(
                overlay,
                acc.currentStream,
                acc.filterParts.length,
                acc.imageInputIndex,
                imagePaths,
                videoDuration
            );

            if (!filterResult) {
                return acc;
            }

            return {
                filterParts: [...acc.filterParts, filterResult.filterPart],
                currentStream: filterResult.outputStream,
                imageInputIndex: filterResult.imageInputIndex ?? acc.imageInputIndex
            };
        },
        {
            filterParts: [],
            currentStream: '[0:v]',
            imageInputIndex: 1
        }
    );

    const finalOutputStream = result.currentStream.replace(/^\[|\]$/g, '');
    console.log(`[buildOverlayFilters] Final output stream: ${finalOutputStream}, filter parts: ${result.filterParts.length}`);

    return {
        filterComplex: result.filterParts.join(';'),
        outputStream: finalOutputStream
    };
};
