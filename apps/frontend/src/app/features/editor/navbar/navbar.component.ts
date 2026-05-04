import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { PlaybackService } from "../../../core/services/playback.service";
import { TimelineService } from "../../../core/services/timeline.service";
import { ExportService } from "../../../core/services/export.service";

@Component({
	selector: "app-navbar",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [
		`
		:host {
			display: flex;
			align-items: center;
			justify-content: space-between;
			height: 48px;
			padding: 0 16px;
			background: var(--card, #ffffff);
			border-bottom: 1px solid var(--border, #e5e5e5);
			flex-shrink: 0;
			z-index: 100;
			gap: 12px;
		}

		.brand {
			font-weight: 700;
			font-size: 15px;
			color: var(--foreground, #000);
			flex-shrink: 0;
		}

		.spacer { flex: 1; }

		.controls {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.time {
			font-size: 12px;
			color: var(--muted-foreground, #888);
			font-variant-numeric: tabular-nums;
			min-width: 110px;
			text-align: right;
		}

		button {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 0 14px;
			height: 32px;
			border-radius: 6px;
			border: 1px solid var(--border, #e5e5e5);
			background: transparent;
			color: var(--foreground, #000);
			font-size: 13px;
			font-family: inherit;
			cursor: pointer;
			white-space: nowrap;
			transition: background 0.1s;
		}

		button:hover:not(:disabled) { background: var(--accent, #f5f5f5); }

		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		button.export-btn {
			background: var(--primary, #d4a853);
			border-color: transparent;
			color: var(--primary-foreground, #000);
			font-weight: 600;
			min-width: 110px;
			justify-content: center;
		}

		button.export-btn:hover:not(:disabled) {
			filter: brightness(1.08);
		}

		.progress-bar-wrap {
			width: 90px;
			height: 4px;
			background: var(--border, #e5e5e5);
			border-radius: 2px;
			overflow: hidden;
		}

		.progress-bar {
			height: 100%;
			background: var(--primary, #d4a853);
			transition: width 0.3s;
		}

		.error-badge {
			font-size: 11px;
			color: #ef4444;
			max-width: 200px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`,
	],
	template: `
		<span class="brand">Combo</span>

		<div class="controls">
			<button (click)="playback.togglePlay()">
				{{ playback.playing() ? '⏸' : '▶' }}
			</button>
			<button (click)="playback.stop()">⏹</button>
		</div>

		<span class="spacer"></span>

		<span class="time">
			{{ timeline.formatTime(timeline.currentTime()) }}
			/ {{ timeline.formatTime(timeline.duration()) }}
		</span>

		<!-- Export progress bar (shown while rendering) -->
		@if (exporter.status() === 'processing') {
			<div class="progress-bar-wrap">
				<div class="progress-bar" [style.width.%]="exporter.progress()"></div>
			</div>
		}

		<!-- Error badge -->
		@if (exporter.status() === 'failed') {
			<span class="error-badge" [title]="exporter.error() ?? ''">
				⚠ {{ exporter.error() }}
			</span>
		}

		<button
			class="export-btn"
			[disabled]="exporter.status() === 'processing' || exporter.status() === 'queued'"
			(click)="startExport()"
		>
			@switch (exporter.status()) {
				@case ('queued')     { ⏳ Queuing… }
				@case ('processing') { {{ exporter.progress() }}% Rendering }
				@case ('done')       { ✓ Done }
				@case ('failed')     { Retry Export }
				@default             { ↓ Export MP4 }
			}
		</button>
	`,
})
export class NavbarComponent {
	protected readonly playback = inject(PlaybackService);
	protected readonly timeline = inject(TimelineService);
	protected readonly exporter = inject(ExportService);

	protected startExport(): void {
		this.exporter.startExport().catch(() => {});
	}
}
