import type { TextOverlay } from "../../edit-video/edit-video.types.ts";
import { getFontFileParameter } from "../../utils/font.utils.ts";
import {
	buildEnableExpression,
	buildPositionExpression,
	escapeTextForFFmpeg,
} from "./overlay-utils.ts";

export const buildTextOverlayFilter = (
	overlay: TextOverlay,
	currentStream: string,
	outputLabel: string,
): string => {
	const fontSize = overlay.fontSize ?? 24;
	const fontColor = overlay.fontColor ?? "white";
	const bgColor = overlay.backgroundColor ?? "black@0.5";
	const opacity = overlay.opacity ?? 1;
	const x = buildPositionExpression(overlay.x, "x");
	const y = buildPositionExpression(overlay.y, "y");
	const enable = buildEnableExpression(overlay.start, overlay.end);
	const escapedText = escapeTextForFFmpeg(overlay.text);
	const fontFileParam = getFontFileParameter();

	const fontSizeExpression = `h*${fontSize}/240`;

	const hasTransparentBg =
		!bgColor ||
		bgColor === "transparent" ||
		bgColor === "none" ||
		bgColor === "";

	const base = `${currentStream}drawtext=${fontFileParam}:text='${escapedText}':fontsize=${fontSizeExpression}:fontcolor=${fontColor}@${opacity}:x=${x}:y=${y}:enable='${enable}'`;
	return hasTransparentBg
		? `${base}[${outputLabel}]`
		: `${base}:box=1:boxcolor=${bgColor}:boxborderw=5[${outputLabel}]`;
};
