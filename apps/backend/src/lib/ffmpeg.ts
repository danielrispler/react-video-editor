import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// ─── Types (mirrors frontend editor.models.ts) ────────────────────────────────

export interface TrackItemTrim {
	from: number;
	to: number;
}

export interface TrackItem {
	id: string;
	type: "video" | "audio" | "text" | "image" | "shape" | "caption";
	duration: number;
	display: { from: number; to: number };
	trim?: TrackItemTrim;
	details: Record<string, unknown>;
}

export interface Track {
	id: string;
	type: string;
	items: TrackItem[];
}

export interface Design {
	id: string;
	fps: number;
	width: number;
	height: number;
	duration: number;
	tracks: Track[];
}

// ─── Job store (in-memory) ────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface RenderJob {
	id: string;
	status: JobStatus;
	/** 0–100 */
	progress: number;
	error?: string;
	outputPath?: string;
	createdAt: number;
}

const jobs = new Map<string, RenderJob>();

// Cleanup jobs older than 1 hour
setInterval(
	() => {
		const cutoff = Date.now() - 60 * 60 * 1000;
		for (const [id, job] of jobs) {
			if (job.createdAt < cutoff) {
				if (job.outputPath) {
					rm(path.dirname(job.outputPath), {
						recursive: true,
						force: true,
					}).catch(() => {});
				}
				jobs.delete(id);
			}
		}
	},
	10 * 60 * 1000,
);

export function getJob(id: string): RenderJob | undefined {
	return jobs.get(id);
}

export function createJob(): RenderJob {
	const id = crypto.randomUUID();
	const job: RenderJob = {
		id,
		status: "pending",
		progress: 0,
		createdAt: Date.now(),
	};
	jobs.set(id, job);
	return job;
}

// ─── Render orchestrator ──────────────────────────────────────────────────────

/**
 * Starts the render in the background. Returns immediately with the job ID.
 * Progress and result are tracked in `jobs` map.
 */
export function startRender(job: RenderJob, design: Design): void {
	job.status = "processing";

	renderToMp4(design, (progress) => {
		job.progress = progress;
	})
		.then((outputPath) => {
			job.outputPath = outputPath;
			job.status = "done";
			job.progress = 100;
		})
		.catch((err: unknown) => {
			job.status = "failed";
			job.error =
				err instanceof Error ? err.message : "Unknown render error";
		});
}

// ─── Core render logic ────────────────────────────────────────────────────────

async function renderToMp4(
	design: Design,
	onProgress: (pct: number) => void,
): Promise<string> {
	const tempDir = await mkdtemp(path.join(tmpdir(), "vrender-"));

	// Download all media referenced in the design
	const mediaMap = new Map<string, string>();
	let fileIdx = 0;

	for (const track of design.tracks) {
		for (const item of track.items) {
			const src = item.details.src as string | undefined;
			if (src && !mediaMap.has(src)) {
				const ext = urlExtension(src);
				const local = path.join(tempDir, `m${fileIdx++}${ext}`);
				await downloadFile(src, local);
				mediaMap.set(src, local);
			}
		}
	}

	const outputPath = path.join(tempDir, "output.mp4");
	const args = buildArgs(design, mediaMap, outputPath);
	await runFFmpeg(args, design.duration, onProgress);
	return outputPath;
}

// ─── FFmpeg command builder ───────────────────────────────────────────────────

function buildArgs(
	design: Design,
	mediaMap: Map<string, string>,
	outputPath: string,
): string[] {
	const { fps, width, height, duration, tracks } = design;
	const totalSec = duration / 1000;

	const inputs: string[] = [];
	const filters: string[] = [];
	const audioLabels: string[] = [];
	let idx = 0;

	// ── Black base video ──────────────────────────────────────────────────────
	inputs.push(
		"-f", "lavfi",
		"-i", `color=c=black:s=${width}x${height}:r=${fps}:d=${totalSec.toFixed(3)}`,
	);
	let videoOut = "[0:v]";
	idx++;

	// ── Video / image tracks (reversed so first track is topmost) ─────────────
	const visualTracks = tracks.filter(
		(t) => t.type === "video" || t.type === "image",
	);

	for (const track of visualTracks) {
		for (const item of track.items) {
			const src = item.details.src as string | undefined;
			const local = src ? mediaMap.get(src) : undefined;
			if (!local) continue;

			const startSec = item.display.from / 1000;
			const endSec = item.display.to / 1000;
			const durSec = item.duration / 1000;
			const trimFrom = ((item.trim?.from ?? 0) / 1000).toFixed(3);
			const trimTo = (
				(item.trim?.from ?? 0) / 1000 +
				durSec
			).toFixed(3);
			const x = Math.round((item.details.x as number) ?? 0);
			const y = Math.round((item.details.y as number) ?? 0);
			const w = Math.round((item.details.width as number) ?? width);
			const h = Math.round((item.details.height as number) ?? height);
			const opacity = (item.details.opacity as number) ?? 1;

			const scaled = `[vs${idx}]`;
			const overlaid = `[vo${idx}]`;

			if (track.type === "video") {
				inputs.push("-i", local);
				filters.push(
					`[${idx}:v]trim=start=${trimFrom}:end=${trimTo},setpts=PTS-STARTPTS,scale=${w}:${h},format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}${scaled}`,
				);
			} else {
				// image — loop for duration
				inputs.push("-loop", "1", "-t", durSec.toFixed(3), "-i", local);
				filters.push(
					`[${idx}:v]scale=${w}:${h},format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}${scaled}`,
				);
			}

			// Overlay at correct time, correct position
			const delay = `setpts=PTS+${startSec.toFixed(3)}/TB`;
			const delayed = `[vd${idx}]`;
			filters.push(`${scaled}${delay}${delayed}`);
			filters.push(
				`${videoOut}${delayed}overlay=${x}:${y}:enable='between(t,${startSec.toFixed(3)},${endSec.toFixed(3)})'${overlaid}`,
			);
			videoOut = overlaid;
			idx++;
		}
	}

	// ── Audio tracks ──────────────────────────────────────────────────────────
	const audioTracks = tracks.filter((t) => t.type === "audio");

	for (const track of audioTracks) {
		for (const item of track.items) {
			const src = item.details.src as string | undefined;
			const local = src ? mediaMap.get(src) : undefined;
			if (!local) continue;

			const startMs = item.display.from;
			const durSec = item.duration / 1000;
			const trimFrom = ((item.trim?.from ?? 0) / 1000).toFixed(3);
			const trimTo = (
				(item.trim?.from ?? 0) / 1000 +
				durSec
			).toFixed(3);
			const vol = (item.details.volume as number) ?? 1;

			inputs.push("-i", local);
			const aLabel = `[a${idx}]`;
			filters.push(
				`[${idx}:a]atrim=start=${trimFrom}:end=${trimTo},asetpts=PTS-STARTPTS,adelay=${startMs}|${startMs},volume=${vol.toFixed(3)}${aLabel}`,
			);
			audioLabels.push(aLabel);
			idx++;
		}
	}

	// ── Assemble command ──────────────────────────────────────────────────────
	const cmd: string[] = ["-hide_banner", "-loglevel", "error", "-progress", "pipe:1"];
	cmd.push(...inputs);

	if (filters.length > 0) {
		cmd.push("-filter_complex", filters.join(";"));
	}

	cmd.push("-map", videoOut);

	if (audioLabels.length === 1) {
		cmd.push("-map", audioLabels[0]);
	} else if (audioLabels.length > 1) {
		// amix is already in filters if we added a mix step; here we push inline
		const amixOut = "[amix]";
		// We need to append to filters — but cmd is separate. Rebuild:
		// Instead, add amix to filter_complex index we already have
		const mixFilter = `${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0${amixOut}`;
		// Replace the last -filter_complex value
		const fcIdx = cmd.lastIndexOf("-filter_complex");
		if (fcIdx !== -1) {
			cmd[fcIdx + 1] += `;${mixFilter}`;
		} else {
			cmd.push("-filter_complex", mixFilter);
		}
		cmd.push("-map", amixOut);
	}

	cmd.push(
		"-t", totalSec.toFixed(3),
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac",
		"-b:a", "192k",
		"-movflags", "+faststart",
		"-y",
		outputPath,
	);

	return cmd;
}

// ─── FFmpeg executor with progress ────────────────────────────────────────────

function runFFmpeg(
	args: string[],
	totalDurationMs: number,
	onProgress: (pct: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

		// Parse progress from stdout (we used -progress pipe:1)
		let stdoutBuf = "";
		proc.stdout?.on("data", (chunk: Buffer) => {
			stdoutBuf += chunk.toString();
			const lines = stdoutBuf.split("\n");
			stdoutBuf = lines.pop() ?? "";
			for (const line of lines) {
				// out_time_us=1234567
				const m = line.match(/^out_time_us=(\d+)/);
				if (m) {
					const elapsedMs = Number(m[1]) / 1000;
					const pct = Math.min(99, Math.round((elapsedMs / totalDurationMs) * 100));
					onProgress(pct);
				}
			}
		});

		let stderrLog = "";
		proc.stderr?.on("data", (chunk: Buffer) => {
			stderrLog += chunk.toString();
		});

		proc.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(
					new Error(`FFmpeg exited with code ${code}\n${stderrLog.slice(-1000)}`),
				);
			}
		});

		proc.on("error", (err) => {
			reject(new Error(`Failed to spawn ffmpeg: ${err.message}\nIs FFmpeg installed?`));
		});
	});
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function downloadFile(url: string, dest: string): Promise<void> {
	const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
	if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(dest, buf);
}

function urlExtension(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		const ext = path.extname(pathname);
		if (ext && ext.length <= 5) return ext;
	} catch {}
	return ".bin";
}
