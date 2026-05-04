import fs from "node:fs";
import os from "node:os";

const FONT_CANDIDATES: Record<string, string[]> = {
	darwin: [
		"/System/Library/Fonts/Supplemental/Arial.ttf",
		"/System/Library/Fonts/Supplemental/Helvetica.ttf",
		"/Library/Fonts/Arial.ttf",
	],
	linux: [
		"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
		"/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
		"/usr/share/fonts/truetype/freefont/FreeSans.ttf",
	],
	win32: [
		"C:\\Windows\\Fonts\\arial.ttf",
		"C:\\Windows\\Fonts\\segoeui.ttf",
		"C:\\Windows\\Fonts\\calibri.ttf",
	],
};

/**
 * Returns the first existing font path from the platform-specific candidate list.
 * FFMPEG_FONT_PATH is checked first if set.
 */
export function getResolvedFontPath(): string | null {
	const envFontPath = process.env.FFMPEG_FONT_PATH;
	if (envFontPath && fs.existsSync(envFontPath)) {
		return envFontPath;
	}

	const platform = os.platform();
	const candidates: string[] =
		FONT_CANDIDATES[platform] ?? FONT_CANDIDATES.linux ?? [];

	for (const fontPath of candidates) {
		try {
			if (fs.existsSync(fontPath)) {
				return fontPath;
			}
		} catch {}
	}

	return null;
}

/**
 * Escape font path for FFmpeg drawtext filter (fontfile=...).
 * - Windows: backslashes to forward slashes so we don't need to double-escape.
 * - Colons and other special chars escaped for filter syntax.
 */
export function escapeFontPathForFFmpeg(fontPath: string): string {
	if (!fontPath) return "";
	// Use forward slashes so FFmpeg filter parser doesn't choke on backslashes
	let escaped = fontPath.replace(/\\/g, "/");
	escaped = escaped.replace(/:/g, "\\:");
	escaped = escaped.replace(/\[/g, "\\[");
	escaped = escaped.replace(/\]/g, "\\]");
	escaped = escaped.replace(/,/g, "\\,");
	escaped = escaped.replace(/;/g, "\\;");
	escaped = escaped.replace(/'/g, "'\\''");
	return escaped;
}

/**
 * Returns drawtext fontfile parameter. MUST always provide a valid font so drawtext doesn't error.
 * Throws if no font path is found (cross-platform resolver found nothing).
 */
export function getFontFileParameter(): string {
	const fontPath = getResolvedFontPath();
	if (!fontPath) {
		const platform = os.platform();
		const candidates = (
			FONT_CANDIDATES[platform] ??
			FONT_CANDIDATES.linux ??
			[]
		).join(", ");
		throw new Error(
			`No font filename provided: no usable font found for drawtext. Tried (${platform}): ${candidates}. Set FFMPEG_FONT_PATH to a path to a .ttf font file, or install one of the candidate fonts.`,
		);
	}
	const escaped = escapeFontPathForFFmpeg(fontPath);
	return `fontfile='${escaped}'`;
}

/** @deprecated Use getResolvedFontPath() or getFontFileParameter() */
export function getUnicodeFontPath(): string | null {
	return getResolvedFontPath();
}

export function containsRTL(text: string): boolean {
	const rtlRegex =
		/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
	return rtlRegex.test(text);
}

export function prepareRTLText(text: string): string {
	if (!text || !containsRTL(text)) {
		return text;
	}
	return text.split("").reverse().join("");
}
