import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OverlayType } from "../../types/types.ts";
import { buildTextOverlayFilter } from "./text-overlay.service.ts";

describe("buildTextOverlayFilter", () => {
	it("uses the text box width to center aligned text", () => {
		const filter = buildTextOverlayFilter(
			{
				id: "11111111-1111-1111-1111-111111111111",
				type: OverlayType.text,
				text: "בדיקה לרוני",
				start: 0,
				end: 5,
				x: 20,
				y: 30,
				fontSize: 64,
				canvasWidth: 1080,
				canvasHeight: 1920,
				elementWidth: 600,
				textAlign: "center",
			},
			"[0:v]",
			"v1",
		);

		assert.match(filter, /x=W\*20\/100\+\(w\*600\/1080-text_w\)\/2/);
		assert.match(filter, /text='בדיקה לרוני'/);
	});
});
