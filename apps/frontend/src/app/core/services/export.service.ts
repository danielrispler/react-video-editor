import { Injectable, inject, signal } from "@angular/core";
import { EditorStateService } from "./editor-state.service";

export type ExportStatus = "idle" | "queued" | "processing" | "done" | "failed";

@Injectable({ providedIn: "root" })
export class ExportService {
	private readonly editorState = inject(EditorStateService);

	readonly status = signal<ExportStatus>("idle");
	readonly progress = signal(0);
	readonly error = signal<string | null>(null);

	private pollTimer: ReturnType<typeof setTimeout> | null = null;

	// ─── Public API ────────────────────────────────────────────────────────────

	async startExport(): Promise<void> {
		if (this.status() === "processing" || this.status() === "queued") return;

		this.status.set("queued");
		this.progress.set(0);
		this.error.set(null);

		try {
			const design = this.editorState.design();

			const res = await fetch("/api/export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ design }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({})) as Record<string, unknown>;
				throw new Error((body["error"] as string) ?? `Server error ${res.status}`);
			}

			const { jobId } = await res.json() as { jobId: string };
			this.status.set("processing");
			this.poll(jobId);
		} catch (err) {
			this.fail(err);
		}
	}

	cancel(): void {
		this.stopPoll();
		this.status.set("idle");
		this.progress.set(0);
		this.error.set(null);
	}

	// ─── Polling ───────────────────────────────────────────────────────────────

	private poll(jobId: string): void {
		this.pollTimer = setTimeout(() => this.checkStatus(jobId), 1_000);
	}

	private async checkStatus(jobId: string): Promise<void> {
		try {
			const res = await fetch(`/api/export/${jobId}`);

			if (!res.ok) {
				throw new Error(`Status check failed: ${res.status}`);
			}

			const data = await res.json() as {
				status: string;
				progress: number;
				error: string | null;
			};

			this.progress.set(data.progress ?? 0);

			if (data.status === "done") {
				this.status.set("done");
				await this.triggerDownload(jobId);
			} else if (data.status === "failed") {
				throw new Error(data.error ?? "Render failed on server");
			} else {
				// Still processing — poll again
				this.poll(jobId);
			}
		} catch (err) {
			this.fail(err);
		}
	}

	// ─── Download ──────────────────────────────────────────────────────────────

	private async triggerDownload(jobId: string): Promise<void> {
		try {
			const res = await fetch(`/api/export/${jobId}/file`);

			if (!res.ok) {
				const body = await res.json().catch(() => ({})) as Record<string, unknown>;
				throw new Error((body["error"] as string) ?? "Download failed");
			}

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `export-${this.editorState.design().id}.mp4`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);

			// Reset to idle after a short delay
			setTimeout(() => {
				if (this.status() === "done") this.status.set("idle");
			}, 3_000);
		} catch (err) {
			this.fail(err);
		}
	}

	// ─── Helpers ───────────────────────────────────────────────────────────────

	private fail(err: unknown): void {
		this.stopPoll();
		this.status.set("failed");
		this.error.set(err instanceof Error ? err.message : "Unknown error");
	}

	private stopPoll(): void {
		if (this.pollTimer !== null) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}
	}
}
