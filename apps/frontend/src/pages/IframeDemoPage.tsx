import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type EditorResponse = {
	type?: string;
	requestId?: string;
	reason?: string;
	itemId?: string;
};

const DEMO_PREVIEW_CHANNEL_ID = "demo-recording";
const DEMO_PREVIEW_SEGMENT_START_MS = 1778412270000;
const DEMO_PREVIEW_DEFAULT_START_MS = DEMO_PREVIEW_SEGMENT_START_MS;
const DEMO_PREVIEW_DEFAULT_END_MS = DEMO_PREVIEW_SEGMENT_START_MS + 30000;
const PANEL_WIDTH = 380;
const MIN_IFRAME_W = 320;
const MIN_IFRAME_H = 200;

const editorOrigin =
	typeof window === "undefined" ? "" : window.location.origin;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

export default function IframeDemoPage() {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [channelId, setChannelId] = useState(DEMO_PREVIEW_CHANNEL_ID);
	const [startTimeMs, setStartTimeMs] = useState(DEMO_PREVIEW_DEFAULT_START_MS);
	const [endTimeMs, setEndTimeMs] = useState(DEMO_PREVIEW_DEFAULT_END_MS);
	const [lastResponse, setLastResponse] = useState<EditorResponse | null>(null);

	// iframe position + size
	const areaW = () => window.innerWidth - PANEL_WIDTH;
	const [box, setBox] = useState({
		x: 40,
		y: 40,
		w: Math.max(
			MIN_IFRAME_W,
			Math.min(900, window.innerWidth - PANEL_WIDTH - 80),
		),
		h: Math.max(MIN_IFRAME_H, window.innerHeight - 80),
	});

	const drag = useRef<{
		startX: number;
		startY: number;
		origBox: typeof box;
	} | null>(null);
	const resize = useRef<{
		dir: ResizeDir;
		startX: number;
		startY: number;
		origBox: typeof box;
	} | null>(null);

	const demoPayload = useMemo(
		() => ({
			type: "EDITOR_ADD_PREVIEW_ITEM",
			requestId: "demo-preview-item",
			payload: {
				kind: "recording-range",
				channelId,
				startTimeMs,
				endTimeMs,
				durationMs: Math.max(endTimeMs - startTimeMs, 1),
			},
		}),
		[channelId, startTimeMs, endTimeMs],
	);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.origin !== editorOrigin) return;
			const payload =
				typeof event.data === "string"
					? (JSON.parse(event.data) as EditorResponse)
					: (event.data as EditorResponse);
			if (!String(payload?.type ?? "").startsWith("EDITOR_")) return;
			setLastResponse(payload);
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

	const clampBox = useCallback((b: typeof box): typeof box => {
		const maxW = areaW();
		const maxH = window.innerHeight;
		const w = Math.max(MIN_IFRAME_W, Math.min(b.w, maxW));
		const h = Math.max(MIN_IFRAME_H, Math.min(b.h, maxH));
		const x = Math.max(0, Math.min(b.x, maxW - w));
		const y = Math.max(0, Math.min(b.y, maxH - h));
		return { x, y, w, h };
	}, []);

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (drag.current) {
				const dx = e.clientX - drag.current.startX;
				const dy = e.clientY - drag.current.startY;
				const { x, y, w, h } = drag.current.origBox;
				setBox(clampBox({ x: x + dx, y: y + dy, w, h }));
				return;
			}
			if (resize.current) {
				const dx = e.clientX - resize.current.startX;
				const dy = e.clientY - resize.current.startY;
				const { x, y, w, h } = resize.current.origBox;
				const dir = resize.current.dir!;
				let nx = x,
					ny = y,
					nw = w,
					nh = h;

				if (dir.includes("e")) nw = w + dx;
				if (dir.includes("s")) nh = h + dy;
				if (dir.includes("w")) {
					nw = w - dx;
					nx = x + dx;
				}
				if (dir.includes("n")) {
					nh = h - dy;
					ny = y + dy;
				}

				setBox(clampBox({ x: nx, y: ny, w: nw, h: nh }));
			}
		};

		const onUp = () => {
			drag.current = null;
			resize.current = null;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			// re-show iframe pointer events
			if (iframeRef.current) iframeRef.current.style.pointerEvents = "auto";
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [clampBox]);

	const startDrag = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";
			document.body.style.userSelect = "none";
			document.body.style.cursor = "grabbing";
			drag.current = { startX: e.clientX, startY: e.clientY, origBox: box };
		},
		[box],
	);

	const startResize = useCallback(
		(dir: ResizeDir) => (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";
			document.body.style.userSelect = "none";
			const cursors: Record<string, string> = {
				n: "n-resize",
				s: "s-resize",
				e: "e-resize",
				w: "w-resize",
				ne: "ne-resize",
				nw: "nw-resize",
				se: "se-resize",
				sw: "sw-resize",
			};
			document.body.style.cursor = cursors[dir!] || "default";
			resize.current = {
				dir,
				startX: e.clientX,
				startY: e.clientY,
				origBox: box,
			};
		},
		[box],
	);

	const postToEditor = (payload: object) => {
		iframeRef.current?.contentWindow?.postMessage(payload, editorOrigin);
	};

	const H = 8; // handle size px

	return (
		<div className="h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 flex">
			{/* Free area for iframe */}
			<div
				className="flex-1 relative overflow-hidden"
			>
				{/* Iframe window */}
				<div
					className="absolute rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden"
					style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
				>
					{/* Title bar — drag handle */}
					<div
						className="h-8 bg-zinc-800 flex items-center px-3 gap-2 cursor-grab select-none flex-none"
						onMouseDown={startDrag}
					>
						<div className="w-2.5 h-2.5 rounded-full bg-red-500" />
						<div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
						<div className="w-2.5 h-2.5 rounded-full bg-green-500" />
						<span className="ml-2 text-xs text-zinc-400">Editor</span>
					</div>

					{/* Iframe fills rest */}
					<iframe
						ref={iframeRef}
						title="Editor iframe demo"
						src="/editor/embed"
						className="w-full bg-white"
						style={{ height: "calc(100% - 32px)", display: "block" }}
					/>

					{/* Resize handles */}
					{/* Corners */}
					{(["nw", "ne", "sw", "se"] as ResizeDir[]).map((dir) => (
						<div
							key={dir!}
							onMouseDown={startResize(dir)}
							style={{
								position: "absolute",
								width: H * 2,
								height: H * 2,
								top: dir!.includes("n") ? 0 : undefined,
								bottom: dir!.includes("s") ? 0 : undefined,
								left: dir!.includes("w") ? 0 : undefined,
								right: dir!.includes("e") ? 0 : undefined,
								cursor: `${dir}-resize`,
								zIndex: 10,
							}}
						/>
					))}
					{/* Edges */}
					<div
						onMouseDown={startResize("n")}
						style={{
							position: "absolute",
							top: 0,
							left: H * 2,
							right: H * 2,
							height: H,
							cursor: "n-resize",
							zIndex: 9,
						}}
					/>
					<div
						onMouseDown={startResize("s")}
						style={{
							position: "absolute",
							bottom: 0,
							left: H * 2,
							right: H * 2,
							height: H,
							cursor: "s-resize",
							zIndex: 9,
						}}
					/>
					<div
						onMouseDown={startResize("w")}
						style={{
							position: "absolute",
							left: 0,
							top: H * 2,
							bottom: H * 2,
							width: H,
							cursor: "w-resize",
							zIndex: 9,
						}}
					/>
					<div
						onMouseDown={startResize("e")}
						style={{
							position: "absolute",
							right: 0,
							top: H * 2,
							bottom: H * 2,
							width: H,
							cursor: "e-resize",
							zIndex: 9,
						}}
					/>
				</div>
			</div>

			{/* Right panel — fixed */}
			<aside
				className="flex-none h-full border-l border-zinc-800 bg-zinc-900 p-6 overflow-y-auto flex flex-col gap-6"
				style={{ width: PANEL_WIDTH }}
			>
				<div>
					<h1 className="text-2xl font-semibold">Iframe demo flow</h1>
					<p className="mt-2 text-sm text-zinc-400">
						Send a demo recording-range payload to the embedded editor. The
						editor calls <code>/api/editor/preview-source</code>, the backend
						converts demo DASH to HLS, and the item is inserted into the scene.
					</p>
				</div>

				<div className="space-y-4">
					<label className="block text-sm">
						<span className="mb-1 block text-zinc-400">Channel ID</span>
						<input
							className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
							value={channelId}
							onChange={(e) => setChannelId(e.target.value)}
						/>
					</label>
					<label className="block text-sm">
						<span className="mb-1 block text-zinc-400">Start time ms</span>
						<input
							className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
							type="number"
							value={startTimeMs}
							onChange={(e) => setStartTimeMs(Number(e.target.value))}
						/>
					</label>
					<label className="block text-sm">
						<span className="mb-1 block text-zinc-400">End time ms</span>
						<input
							className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
							type="number"
							value={endTimeMs}
							onChange={(e) => setEndTimeMs(Number(e.target.value))}
						/>
					</label>
				</div>

				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-zinc-950"
						onClick={() =>
							postToEditor({ ...demoPayload, requestId: crypto.randomUUID() })
						}
					>
						Add demo recording
					</button>
					<button
						type="button"
						className="rounded-xl border border-zinc-700 px-4 py-2"
						onClick={() =>
							postToEditor({
								type: "EDITOR_CLEAR_PROJECT",
								requestId: crypto.randomUUID(),
							})
						}
					>
						Clear project
					</button>
				</div>

				<pre className="overflow-auto rounded-2xl border border-zinc-800 bg-black/40 p-4 text-xs text-zinc-300">
					{JSON.stringify(
						{ outgoingMessage: demoPayload, lastResponse },
						null,
						2,
					)}
				</pre>
			</aside>
		</div>
	);
}
