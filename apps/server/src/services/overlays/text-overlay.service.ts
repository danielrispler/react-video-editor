import type { TextOverlay } from "../../edit-video/edit-video.types.ts";
import { getFontFileParameter } from "../../utils/font.utils.ts";
import {
	buildEnableExpression,
	buildPositionExpression,
	escapeTextForFFmpeg,
} from "./overlay-utils.ts";

/**
 * Pre-wrap text to approximate the word-wrap behaviour of the browser editor.
 *
 * FFmpeg `drawtext` does not support automatic word wrapping. We insert `\n`
 * newlines by estimating how many characters fit on one line using:
 *   avgCharWidth ≈ fontSize * 0.55   (proportional-font heuristic)
 *   charsPerLine = elementWidth / avgCharWidth
 *
 * Both `elementWidth` and `fontSize` are in design-canvas pixels so their
 * ratio is resolution-independent.
 */
const preWrapText = (
	text: string,
	fontSize: number,
	elementWidth: number | undefined,
): string => {
	if (!elementWidth || elementWidth <= 0) return text;

	const avgCharWidth = fontSize * 0.55;
	const maxChars = Math.max(1, Math.floor(elementWidth / avgCharWidth));

	// Respect existing newlines first, then wrap within each segment.
	const segments = text.split("\n");
	const wrappedSegments = segments.map((segment) => {
		const words = segment.split(" ");
		const lines: string[] = [];
		let current = "";
		for (const word of words) {
			const test = current ? `${current} ${word}` : word;
			if (test.length > maxChars && current) {
				lines.push(current);
				current = word;
			} else {
				current = test;
			}
		}
		if (current) lines.push(current);
		return lines.join("\n");
	});

	return wrappedSegments.join("\n");
};

export const buildTextOverlayFilter = (
	overlay: TextOverlay,
	currentStream: string,
	outputLabel: string,
): string => {
	const fontSize = overlay.fontSize ?? 24;
	const fontColor = overlay.fontColor ?? "white";
	const bgColor = overlay.backgroundColor ?? "black@0.5";
	const opacity = overlay.opacity ?? 1;
	const strokeWidth = overlay.strokeWidth ?? 0;
	const strokeColor = overlay.strokeColor ?? "black";
	const xBase = buildPositionExpression(overlay.x, "x");
	const y = buildPositionExpression(overlay.y, "y");
	const enable = buildEnableExpression(overlay.start, overlay.end);
	const fontFileParam = getFontFileParameter();

	// Scale font size proportionally: the design stores fontSize in canvas-pixel
	// space; dividing by canvasHeight and multiplying by the video's `h` keeps
	// the same visual ratio regardless of output resolution.
	const referenceHeight = overlay.canvasHeight ?? 240;
	const fontSizeExpression = `h*${fontSize}/${referenceHeight}`;

	// Pre-wrap text so it doesn't overflow the element's designed width.
	const wrappedText = preWrapText(overlay.text, fontSize, overlay.elementWidth);
	const escapedText = escapeTextForFFmpeg(wrappedText);
	const x = (() => {
		if (
			!overlay.elementWidth ||
			!overlay.canvasWidth ||
			overlay.elementWidth <= 0 ||
			overlay.canvasWidth <= 0
		) {
			return xBase;
		}

		const widthExpression = `w*${overlay.elementWidth}/${overlay.canvasWidth}`;
		if (overlay.textAlign === "center") {
			return `${xBase}+(${widthExpression}-text_w)/2`;
		}

		if (overlay.textAlign === "right") {
			return `${xBase}+${widthExpression}-text_w`;
		}

		return xBase;
	})();

	const hasTransparentBg =
		!bgColor ||
		bgColor === "transparent" ||
		bgColor === "none" ||
		bgColor === "";

	const base = `${currentStream}drawtext=${fontFileParam}:text='${escapedText}':fontsize=${fontSizeExpression}:fontcolor=${fontColor}@${opacity}:borderw=${strokeWidth}:bordercolor=${strokeColor}:x=${x}:y=${y}:enable='${enable}'`;
	return hasTransparentBg
		? `${base}[${outputLabel}]`
		: `${base}:box=1:boxcolor=${bgColor}:boxborderw=5[${outputLabel}]`;
};
