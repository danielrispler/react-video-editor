import { useEffect, useMemo, useRef, useState } from "react";

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

const editorOrigin =
	typeof window === "undefined" ? "" : window.location.origin;

export default function IframeDemoPage() {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [channelId, setChannelId] = useState(DEMO_PREVIEW_CHANNEL_ID);
	const [startTimeMs, setStartTimeMs] = useState(DEMO_PREVIEW_DEFAULT_START_MS);
	const [endTimeMs, setEndTimeMs] = useState(DEMO_PREVIEW_DEFAULT_END_MS);
	const [lastResponse, setLastResponse] = useState<EditorResponse | null>(null);
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

	const postToEditor = (payload: object) => {
		iframeRef.current?.contentWindow?.postMessage(payload, editorOrigin);
	};

	return (
		<div className="h-screen overflow-hidden bg-zinc-950 px-6 py-8 text-zinc-100 flex flex-col">
			<div className="flex-1 overflow-hidden mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[420px_1fr]">
				<section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 overflow-y-auto">
					<h1 className="text-2xl font-semibold">Iframe demo flow</h1>
					<p className="mt-2 text-sm text-zinc-400">
						Send a demo recording-range payload to the embedded editor. The
						editor calls <code>/api/editor/preview-source</code>, the backend
						converts demo DASH to HLS, and the item is inserted into the scene.
						The editor keeps trim/display state plus canonical metadata instead
						of duplicating the raw request fields.
					</p>

					<div className="mt-6 space-y-4">
						<label className="block text-sm">
							<span className="mb-1 block text-zinc-400">Channel ID</span>
							<input
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
								value={channelId}
								onChange={(event) => setChannelId(event.target.value)}
							/>
						</label>

						<label className="block text-sm">
							<span className="mb-1 block text-zinc-400">Start time ms</span>
							<input
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
								type="number"
								value={startTimeMs}
								onChange={(event) => setStartTimeMs(Number(event.target.value))}
							/>
						</label>

						<label className="block text-sm">
							<span className="mb-1 block text-zinc-400">End time ms</span>
							<input
								className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
								type="number"
								value={endTimeMs}
								onChange={(event) => setEndTimeMs(Number(event.target.value))}
							/>
						</label>
					</div>

					<div className="mt-6 flex flex-wrap gap-3">
						<button
							type="button"
							className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-zinc-950"
							onClick={() =>
								postToEditor({
									...demoPayload,
									requestId: crypto.randomUUID(),
								})
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

					<pre className="mt-6 overflow-auto rounded-2xl border border-zinc-800 bg-black/40 p-4 text-xs text-zinc-300">
						{JSON.stringify(
							{
								outgoingMessage: demoPayload,
								lastResponse,
							},
							null,
							2,
						)}
					</pre>
				</section>

				<section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 h-full">
					<iframe
						ref={iframeRef}
						title="Editor iframe demo"
						src="/editor/embed"
						className="h-full w-full bg-white"
					/>
				</section>
			</div>
		</div>
	);
}
