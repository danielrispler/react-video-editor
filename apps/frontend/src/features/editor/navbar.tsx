import { Icons } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { dispatch } from "@designcombo/events";
import { HISTORY_REDO, HISTORY_UNDO } from "@designcombo/state";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AutosizeInput from "@/components/ui/autosize-input";
import useStore from "@/features/editor/store/use-store";
import {
	useIsLargeScreen,
	useIsSmallScreen,
} from "@/hooks/use-media-query";
import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { IDesign } from "@designcombo/types";
import { debounce } from "lodash";
import DownloadProgressModal from "./download-progress-modal";
import { useDownloadState } from "./store/use-download-state";

const CANVAS_PRESETS = [
	{ label: "דיוקן", width: 1080, height: 1920, tooltip: "1080×1920 — פורטרט" },
	{ label: "נוף", width: 1920, height: 1080, tooltip: "1920×1080 — נוף רחב" },
	{ label: "ריבוע", width: 1080, height: 1080, tooltip: "1080×1080 — ריבוע" },
	{ label: "סטורי", width: 720, height: 1280, tooltip: "1080×1920 — סטורי" },
];

const MIN_CANVAS_SIZE = 64;
const MAX_CANVAS_SIZE = 4096;

export default function Navbar({
	stateManager,
	setProjectName,
	projectName,
}: {
	stateManager: StateManager;
	setProjectName: (name: string) => void;
	projectName: string;
}) {
	const [title, setTitle] = useState(projectName);
	const isLargeScreen = useIsLargeScreen();
	const isSmallScreen = useIsSmallScreen();
	const { size, setSize } = useStore();
	const [canvasWidth, setCanvasWidth] = useState(String(size.width));
	const [canvasHeight, setCanvasHeight] = useState(String(size.height));

	const handleUndo = () => {
		dispatch(HISTORY_UNDO);
	};

	const handleRedo = () => {
		dispatch(HISTORY_REDO);
	};

	// Create a debounced function for setting the project name
	const debouncedSetProjectName = useCallback(
		debounce((name: string) => {
			console.log("Debounced setProjectName:", name);
			setProjectName(name);
		}, 2000), // 2 seconds delay
		[],
	);

	// Update the debounced function whenever the title changes
	useEffect(() => {
		debouncedSetProjectName(title);
	}, [title, debouncedSetProjectName]);

	useEffect(() => {
		setCanvasWidth(String(size.width));
		setCanvasHeight(String(size.height));
	}, [size.width, size.height]);

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTitle(e.target.value);
	};

	const applyCanvasSize = (nextWidth: number, nextHeight: number) => {
		setSize({
			width: nextWidth,
			height: nextHeight,
		});
	};

	const handleCanvasSizeSubmit = () => {
		const parsedWidth = Number.parseInt(canvasWidth, 10);
		const parsedHeight = Number.parseInt(canvasHeight, 10);
		if (
			Number.isNaN(parsedWidth) ||
			Number.isNaN(parsedHeight) ||
			parsedWidth < MIN_CANVAS_SIZE ||
			parsedHeight < MIN_CANVAS_SIZE
		) {
			setCanvasWidth(String(size.width));
			setCanvasHeight(String(size.height));
			return;
		}

		applyCanvasSize(
			Math.min(parsedWidth, MAX_CANVAS_SIZE),
			Math.min(parsedHeight, MAX_CANVAS_SIZE),
		);
	};

	const handleCanvasPresetSelect = (nextWidth: number, nextHeight: number) => {
		setCanvasWidth(String(nextWidth));
		setCanvasHeight(String(nextHeight));
		applyCanvasSize(nextWidth, nextHeight);
	};

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: isLargeScreen ? "320px 1fr 320px" : "1fr 1fr 1fr",
			}}
			className="bg-card pointer-events-none flex h-13 items-center border-b border-border/80 px-2"
		>
			<DownloadProgressModal />

			<div className="flex items-center gap-2">
				<div className=" pointer-events-auto flex h-10 items-center px-1.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={handleUndo}
								className="text-muted-foreground"
								variant="ghost"
								size="icon"
							>
								<Icons.undo width={20} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">בטל פעולה</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={handleRedo}
								className="text-muted-foreground"
								variant="ghost"
								size="icon"
							>
								<Icons.redo width={20} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">בצע שוב</TooltipContent>
					</Tooltip>
				</div>
			</div>

			<div className="flex h-13 items-center justify-center gap-2">
				{!isSmallScreen && (
					<div className=" pointer-events-auto flex h-10 items-center gap-2 rounded-md px-2.5">
						<AutosizeInput
							name="title"
							value={title}
							onChange={handleTitleChange}
							width={200}
							inputClassName="border-none outline-none px-1 text-sm font-medium"
						/>
					</div>
				)}
			</div>

			<div className="flex h-13 items-center justify-end gap-2">
				<div className=" pointer-events-auto flex h-10 items-center gap-2 rounded-md px-2.5">
					<CanvasSizePopover
						canvasHeight={canvasHeight}
						canvasWidth={canvasWidth}
						onApply={handleCanvasSizeSubmit}
						onCanvasHeightChange={setCanvasHeight}
						onCanvasWidthChange={setCanvasWidth}
						onPresetSelect={handleCanvasPresetSelect}
					/>
					{/* <Button
            className="flex h-8 gap-1 border border-border"
            variant="outline"
            size={isMediumScreen ? "sm" : "icon"}
          >
            <ShareIcon width={18} />{" "}
            <span className="hidden md:block">Share</span>
          </Button> */}

					<DownloadPopover stateManager={stateManager} />
				</div>
			</div>
		</div>
	);
}

const CanvasSizePopover = ({
	canvasHeight,
	canvasWidth,
	onApply,
	onCanvasHeightChange,
	onCanvasWidthChange,
	onPresetSelect,
}: {
	canvasHeight: string;
	canvasWidth: string;
	onApply: () => void;
	onCanvasHeightChange: (value: string) => void;
	onCanvasWidthChange: (value: string) => void;
	onPresetSelect: (width: number, height: number) => void;
}) => {
	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							className="h-8 rounded-full border border-border"
							variant="outline"
						>
							קנבס
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">שנה גודל קנבס</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="end"
				className="bg-sidebar z-[250] flex w-72 flex-col gap-4"
			>
				<div className="space-y-1">
					<Label>גודל קנבס</Label>
					<p className="text-muted-foreground text-xs">
						עדכן את רזולוציית העורך והייצוא.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<Label htmlFor="canvas-width">רוחב</Label>
						<Input
							id="canvas-width"
							min={MIN_CANVAS_SIZE}
							max={MAX_CANVAS_SIZE}
							step={1}
							type="number"
							value={canvasWidth}
							onChange={(e) => onCanvasWidthChange(e.target.value)}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="canvas-height">גובה</Label>
						<Input
							id="canvas-height"
							min={MIN_CANVAS_SIZE}
							max={MAX_CANVAS_SIZE}
							step={1}
							type="number"
							value={canvasHeight}
							onChange={(e) => onCanvasHeightChange(e.target.value)}
						/>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{CANVAS_PRESETS.map((preset) => (
						<Tooltip key={preset.label}>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="h-8 rounded-full px-3 text-xs"
									onClick={() => onPresetSelect(preset.width, preset.height)}
								>
									{preset.label} {preset.width}x{preset.height}
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">{preset.tooltip}</TooltipContent>
						</Tooltip>
					))}
				</div>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button onClick={onApply}>החל</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">החל שינויי גודל</TooltipContent>
				</Tooltip>
			</PopoverContent>
		</Popover>
	);
};

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
	const { actions, exportType } = useDownloadState();
	const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
	const [open, setOpen] = useState(false);
	const { size } = useStore();

	const handleExport = () => {
		const data: IDesign = {
			id: generateId(),
			...stateManager.toJSON(),
			size,
		};

		console.log({ data });

		actions.setState({ payload: data });
		actions.startExport();
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							className="flex h-8 w-20 gap-1 border border-border rounded-full shrink-0"
							size="sm"
						>
							<span>הורדה</span>
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">הורד פרויקט</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="end"
				className="bg-sidebar z-[250] flex w-60 flex-col gap-4"
			>
				<Label>הגדרות ייצוא</Label>

				<Popover open={isExportTypeOpen} onOpenChange={setIsExportTypeOpen}>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<Button className="w-full justify-between" variant="outline">
									<div>{exportType.toUpperCase()}</div>
									<ChevronDown width={16} />
								</Button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent side="bottom">בחר פורמט ייצוא</TooltipContent>
					</Tooltip>
					<PopoverContent className="bg-background z-[251] w-[--radix-popover-trigger-width] px-2 py-2">
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-secondary"
							onClick={() => {
								actions.setExportType("mp4");
								setIsExportTypeOpen(false);
							}}
						>
							MP4
						</div>
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-secondary"
							onClick={() => {
								actions.setExportType("json");
								setIsExportTypeOpen(false);
							}}
						>
							JSON
						</div>
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-secondary"
							onClick={() => {
								actions.setExportType("webp");
								setIsExportTypeOpen(false);
							}}
						>
							WEBP
						</div>
					</PopoverContent>
				</Popover>

				<div>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button onClick={handleExport} className="w-full">
								ייצא
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">התחל ייצוא</TooltipContent>
					</Tooltip>
				</div>
			</PopoverContent>
		</Popover>
	);
};
