import { Icons } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { dispatch } from "@designcombo/events";
import { HISTORY_REDO, HISTORY_UNDO } from "@designcombo/state";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AutosizeInput from "@/components/ui/autosize-input";
import {
	useIsLargeScreen,
	useIsMediumScreen,
	useIsSmallScreen,
} from "@/hooks/use-media-query";
import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { IDesign } from "@designcombo/types";
import { debounce } from "lodash";
import DownloadProgressModal from "./download-progress-modal";
import { useDownloadState } from "./store/use-download-state";

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

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTitle(e.target.value);
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
					<Button
						onClick={handleUndo}
						className="text-muted-foreground"
						variant="ghost"
						size="icon"
					>
						<Icons.undo width={20} />
					</Button>
					<Button
						onClick={handleRedo}
						className="text-muted-foreground"
						variant="ghost"
						size="icon"
					>
						<Icons.redo width={20} />
					</Button>
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

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
	const isMediumScreen = useIsMediumScreen();
	const { actions, exportType } = useDownloadState();
	const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
	const [open, setOpen] = useState(false);

	const handleExport = () => {
		const data: IDesign = {
			id: generateId(),
			...stateManager.toJSON(),
		};

		console.log({ data });

		actions.setState({ payload: data });
		actions.startExport();
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					className="flex h-8 gap-1 border border-border rounded-full"
					size={isMediumScreen ? "sm" : "icon"}
				>
					{/* <Download width={18} />{" "} */}
					<span className="hidden md:block">Download</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="bg-sidebar z-[250] flex w-60 flex-col gap-4"
			>
				<Label>Export settings</Label>

				<Popover open={isExportTypeOpen} onOpenChange={setIsExportTypeOpen}>
					<PopoverTrigger asChild>
						<Button className="w-full justify-between" variant="outline">
							<div>{exportType.toUpperCase()}</div>
							<ChevronDown width={16} />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="bg-background z-[251] w-[--radix-popover-trigger-width] px-2 py-2">
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
							onClick={() => {
								actions.setExportType("mp4");
								setIsExportTypeOpen(false);
							}}
						>
							MP4
						</div>
						<div
							className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
							onClick={() => {
								actions.setExportType("json");
								setIsExportTypeOpen(false);
							}}
						>
							JSON
						</div>
					</PopoverContent>
				</Popover>

				<div>
					<Button onClick={handleExport} className="w-full">
						Export
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
};