import { access } from "node:fs/promises";
import path from "node:path";
import type {
	ImageOverlay,
	Overlay,
} from "../../edit-video/edit-video.types.ts";
import { OverlayType } from "../../types/types.ts";
import { downloadFile } from "../../utils/file.utils.ts";
import {
	convertWebpToPng,
	getImageExtension,
} from "../sources/image-process.service.ts";
import {
	buildEnableExpression,
	buildPositionExpression,
} from "./overlay-utils.ts";

export const prepareImageOverlay = async (
	overlay: ImageOverlay,
	tempDir: string,
): Promise<string> => {
	const originalExt = getImageExtension(overlay.imageUrl);
	const imagePath = path.join(tempDir, `overlay-${overlay.id}.${originalExt}`);
	await downloadFile(overlay.imageUrl, imagePath);

	const finalImagePath: string =
		originalExt === "webp" ? await convertWebpToPng(imagePath) : imagePath;

	await access(finalImagePath);
	return finalImagePath;
};

export const prepareImageOverlays = async (
	overlays: Overlay[],
	tempDir: string,
): Promise<{ imageOverlayPaths: string[]; hasOverlays: boolean }> => {
	const hasOverlays = overlays && overlays.length > 0;
	const imageOverlayPaths: string[] = [];

	if (!hasOverlays) return { imageOverlayPaths, hasOverlays: false };

	for (const overlay of overlays) {
		if (overlay.type === OverlayType.image) {
			imageOverlayPaths.push(await prepareImageOverlay(overlay, tempDir));
		}
	}

	return { imageOverlayPaths, hasOverlays: true };
};
export const buildImageOverlayFilter = (
	overlay: ImageOverlay,
	imageInputIndex: number,
	currentStream: string,
	outputLabel: string,
	videoDuration: number,
): string => {
	const widthPixels = overlay.width ?? 200;
	const heightPixels = overlay.height ?? 200;
	const x = buildPositionExpression(overlay.x, "x");
	const y = buildPositionExpression(overlay.y, "y");
	const enable = buildEnableExpression(overlay.start, overlay.end);
	const imgInput = `[${imageInputIndex}:v]`;
	const loopedImgLabel = `looped${imageInputIndex}`;
	const scaledImgLabel = `scaled${imageInputIndex}`;
	const loopSize = Math.ceil(videoDuration * 30);

	return `${imgInput}loop=loop=-1:size=${loopSize}:start=0[${loopedImgLabel}];[${loopedImgLabel}]scale=w=${widthPixels}:h=${heightPixels}:force_original_aspect_ratio=decrease[${scaledImgLabel}];${currentStream}[${scaledImgLabel}]overlay=${x}:${y}:enable='${enable}'[${outputLabel}]`;
};
