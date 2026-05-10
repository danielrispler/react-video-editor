import { download, getExportFilename } from "@/utils/download";
import { IDesign } from "@designcombo/types";
import { create } from "zustand";
import { getSafeCurrentFrame } from "../utils/time";
import useStore from "./use-store";
interface Output {
	url: string;
	type: "json" | "mp4" | "webp";
}

interface DownloadState {
	projectId: string;
	exporting: boolean;
	exportType: "json" | "mp4" | "webp";
	progress: number;
	output?: Output;
	payload?: IDesign;
	displayProgressModal: boolean;
	actions: {
		setProjectId: (projectId: string) => void;
		setExporting: (exporting: boolean) => void;
		setExportType: (exportType: "json" | "mp4" | "webp") => void;
		setProgress: (progress: number) => void;
		setState: (state: Partial<DownloadState>) => void;
		setOutput: (output: Output) => void;
		startExport: () => void;
		setDisplayProgressModal: (displayProgressModal: boolean) => void;
	};
}

const IN_PROGRESS_EXPORT_STATUSES = new Set([
	"PENDING",
	"PROCESSING",
	"PROGRESS",
	"IN_PROGRESS",
	"QUEUED",
]);

//const baseUrl = "https://api.combo.sh/v1";

export const useDownloadState = create<DownloadState>((set, get) => ({
	projectId: "",
	exporting: false,
	exportType: "mp4",
	progress: 0,
	displayProgressModal: false,
	actions: {
		setProjectId: (projectId) => set({ projectId }),
		setExporting: (exporting) => set({ exporting }),
		setExportType: (exportType) => set({ exportType }),
		setProgress: (progress) => set({ progress }),
		setState: (state) => set({ ...state }),
		setOutput: (output) => set({ output }),
		setDisplayProgressModal: (displayProgressModal) =>
			set({ displayProgressModal }),
		startExport: async () => {
			try {
				const { payload, exportType } = get();

				if (!payload) throw new Error("Payload is not defined");

				if (exportType === "json") {
					const blob = new Blob([JSON.stringify(payload, null, 2)], {
						type: "application/json",
					});
					const url = URL.createObjectURL(blob);
					download(url, getExportFilename("json"));
					setTimeout(() => URL.revokeObjectURL(url), 0);
					return;
				}

				set({
					exporting: true,
					displayProgressModal: true,
					progress: 0,
					output: undefined,
				});

				const { playerRef, fps } = useStore.getState();
				const currentFrame = getSafeCurrentFrame(playerRef);
				const safeFps = fps > 0 ? fps : 30;
				const frameTimeMs = Math.round((currentFrame / safeFps) * 1000);

				const response = await fetch("/api/render", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						design: payload,
						options: {
							fps: 30,
							size: payload.size,
							format: exportType,
							frameTimeMs,
						},
					}),
				});

				if (!response.ok) throw new Error("Failed to submit export request.");

				const jobInfo = await response.json();
				const jobId =
					jobInfo?.render?.id || jobInfo?.renderId || jobInfo?.id || "";

				if (!jobId) {
					throw new Error("Export request succeeded without a render job id.");
				}

				const pollUntilComplete = async (): Promise<void> => {
					const statusResponse = await fetch(
						`/api/render?id=${encodeURIComponent(jobId)}&type=${get().exportType}`,
						{
							headers: {
								"Content-Type": "application/json",
							},
						},
					);

					if (!statusResponse.ok) {
						const errorText = await statusResponse.text();
						throw new Error(
							`Failed to fetch export status (${statusResponse.status}): ${errorText}`,
						);
					}

					const statusInfo = await statusResponse.json();
					const render = statusInfo?.render ?? statusInfo;
					const status = String(render?.status ?? "").toUpperCase();
					const progressValue =
						typeof render?.progress === "number"
							? render.progress
							: typeof render?.percentage === "number"
								? render.percentage
								: undefined;
					const url =
						render?.presigned_url || render?.url || render?.download_url || "";

					if (typeof progressValue === "number") {
						set({ progress: progressValue });
					}

					if (status === "COMPLETED") {
						if (!url) {
							throw new Error("Export completed without a download URL.");
						}

						set({
							exporting: false,
							progress: 100,
							output: { url, type: get().exportType },
						});
						return;
					}

					if (IN_PROGRESS_EXPORT_STATUSES.has(status)) {
						await new Promise((resolve) => setTimeout(resolve, 2500));
						await pollUntilComplete();
						return;
					}

					throw new Error(`Export failed with status: ${status || "UNKNOWN"}`);
				};

				await pollUntilComplete();
			} catch (error) {
				console.error(error);
				set({ exporting: false, displayProgressModal: false });
			}
		},
	},
}));
