import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { dispatch } from "@designcombo/events";
import StateManager, { ADD_SHAPE, ADD_TEXT } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { ITrackItem } from "@designcombo/types";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants/constants";
import { TEXT_ADD_PAYLOAD } from "./constants/payload";
import { ControlItem } from "./control-item";
import ControlItemHorizontal from "./control-item-horizontal";
import FloatingControl from "./control-item/floating-controls/floating-control";
import CropModal from "./crop-modal/crop-modal";
import { FONTS } from "./data/fonts";
import { useEditorPostMessage } from "./external-preview/use-editor-post-message";
import useTimelineEvents from "./hooks/use-timeline-events";
import MenuList from "./menu-list";
import Navbar from "./navbar";
import Scene from "./scene";
import type { SceneRef } from "./scene/scene.types";
import useDataState from "./store/use-data-state";
import useLayoutStore from "./store/use-layout-store";
import useStore from "./store/use-store";
import Timeline from "./timeline";
import { getCompactFontData, loadFonts } from "./utils/fonts";

const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const SHAPES_DIRECT = [
	{
		id: "square",
		label: "ריבוע",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="3" y="3" width="94" height="94" rx="6" fill="none" stroke="black" stroke-width="6"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "circle",
		label: "עיגול",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="black" stroke-width="6"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "arrow",
		label: "חץ",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><polygon points="2,18 58,18 58,3 98,30 58,57 58,42 2,42" fill="none" stroke="black" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 120,
		height: 72,
	},
	{
		id: "triangle",
		label: "משולש",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,4 97,96 3,96" fill="none" stroke="black" stroke-width="6" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
].map((s) => ({ ...s, dataUrl: svgToDataUrl(s.svg) }));

const addShape = (shape: (typeof SHAPES_DIRECT)[0]) => {
	dispatch(ADD_SHAPE, {
		payload: {
			id: generateId(),
			type: "shape",
			display: { from: 0, to: 5000 },
			details: {
				src: shape.dataUrl,
				path: "",
				width: shape.width,
				height: shape.height,
				backgroundColor: "transparent",
				opacity: 100,
				transform: "",
				border: "",
				top: "0px",
				left: "0px",
				flipX: false,
				flipY: false,
				rotate: "0deg",
				visibility: "visible" as const,
			},
			metadata: {},
		},
		options: {},
	});
};

const addText = () => {
	dispatch(ADD_TEXT, {
		payload: { ...TEXT_ADD_PAYLOAD, id: nanoid() },
		options: {},
	});
};

const RightSideMenu = () => {
	return (
		<div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1 p-1.5 bg-card border border-border/80 border-r-0 rounded-l-xl shadow-lg">
			<button
				type="button"
				aria-label="טקסט"
				onClick={addText}
				className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 text-muted-foreground hover:bg-secondary hover:text-foreground font-bold text-sm"
			>
				T
			</button>
			{SHAPES_DIRECT.map((shape) => (
				<button
					key={shape.id}
					type="button"
					aria-label={shape.label}
					onClick={() => addShape(shape)}
					className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 text-muted-foreground hover:bg-secondary hover:text-foreground"
				>
					<img
						src={shape.dataUrl}
						alt={shape.label}
						style={{ width: 20, height: 20, objectFit: "contain" }}
					/>
				</button>
			))}
		</div>
	);
};

const stateManager = new StateManager({
	size: {
		width: 1920,
		height: 1080,
	},
});

if (import.meta.env.DEV) {
	(
		window as Window & { __editorStateManager?: typeof stateManager }
	).__editorStateManager = stateManager;
}

const SceneContainer = ({
	sceneRef,
	playerRef,
	stateManager,
	trackItem,
	loaded,
	isLargeScreen,
}: any) => {
	return (
		<div
			dir="ltr"
			className="relative flex h-full w-full flex-col bg-background"
		>
			<div className="flex-1 relative overflow-hidden w-full h-full">
				<div className="flex h-full flex-1">
					<div className="flex-1 relative overflow-hidden w-full h-full">
						<CropModal />
						<Scene ref={sceneRef} stateManager={stateManager} />
					</div>
				</div>
				{!isLargeScreen && !trackItem && loaded && <RightSideMenu />}
			</div>

			<div className="w-full">
				{playerRef && <Timeline stateManager={stateManager} />}
			</div>

			{!isLargeScreen && trackItem && <ControlItemHorizontal />}
		</div>
	);
};

const Sidebar = () => {
	return (
		<div className="bg-card flex h-[calc(100vh-52px)] w-full min-w-0 overflow-hidden border-r border-border/80">
			<div className="flex h-full w-full min-w-0 overflow-hidden">
				<MenuList />
				<ControlItem />
			</div>
		</div>
	);
};

const Editor = ({ tempId, id }: { tempId?: string; id?: string }) => {
	const [projectName, setProjectName] = useState<string>("RoniCut");
	const timelinePanelRef = useRef<ImperativePanelHandle>(null);
	const sceneRef = useRef<SceneRef>(null);
	const { timeline, playerRef } = useStore();
	const { activeIds, trackItemsMap } = useStore();
	const [loaded, setLoaded] = useState(false);
	const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);
	const {
		setTrackItem: setLayoutTrackItem,
		setFloatingControl,
		setLabelControlItem,
		setTypeControlItem,
	} = useLayoutStore();
	const isLargeScreen = useIsLargeScreen();

	useTimelineEvents();
	useEditorPostMessage(stateManager);

	const { setCompactFonts, setFonts } = useDataState();
	useEffect(() => {
		setCompactFonts(getCompactFontData(FONTS));
		setFonts(FONTS);
	}, []);

	useEffect(() => {
		loadFonts([
			{
				name: SECONDARY_FONT,
				url: SECONDARY_FONT_URL,
			},
		]);
	}, []);

	useEffect(() => {
		const screenHeight = window.innerHeight;
		const desiredHeight = 300;
		const percentage = (desiredHeight / screenHeight) * 100;
		timelinePanelRef.current?.resize(percentage);
	}, []);

	const handleTimelineResize = () => {
		const timelineContainer = document.getElementById("timeline-container");
		if (!timelineContainer) return;

		timeline?.resize(
			{
				height: timelineContainer.clientHeight - 90,
				width: timelineContainer.clientWidth - 40,
			},
			{
				force: true,
			},
		);

		setTimeout(() => {
			sceneRef.current?.recalculateZoom();
		}, 100);
	};

	useEffect(() => {
		const onResize = () => handleTimelineResize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [timeline]);

	useEffect(() => {
		if (activeIds.length === 1) {
			const [id] = activeIds;
			const trackItem = trackItemsMap[id];
			if (trackItem) {
				setTrackItem(trackItem);
				setLayoutTrackItem(trackItem);
			}
		} else {
			setTrackItem(null);
			setLayoutTrackItem(null);
		}
	}, [activeIds, trackItemsMap]);

	useEffect(() => {
		setFloatingControl("");
		setLabelControlItem("");
		setTypeControlItem("");
	}, [isLargeScreen]);

	useEffect(() => {
		setLoaded(true);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "t" && e.key !== "T") return;
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			)
				return;
			addText();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<div className="flex h-screen w-screen flex-col">
			<Navbar
				projectName={projectName}
				stateManager={stateManager}
				setProjectName={setProjectName}
			/>

			<div className="flex flex-1">
				{isLargeScreen ? (
					<ResizablePanelGroup direction="horizontal" className="h-full w-full">
						<ResizablePanel
							defaultSize={30}
							minSize={20}
							maxSize={40}
							className="max-w-7xl relative bg-card min-w-0 overflow-visible!"
						>
							<Sidebar />
							<FloatingControl />
						</ResizablePanel>

						<ResizableHandle className="bg-border/90" />

						<ResizablePanel
							defaultSize={70}
							minSize={60}
							className="min-w-0 min-h-0"
						>
							<SceneContainer
								sceneRef={sceneRef}
								playerRef={playerRef}
								stateManager={stateManager}
								trackItem={trackItem}
								loaded={loaded}
								isLargeScreen={isLargeScreen}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				) : (
					<SceneContainer
						sceneRef={sceneRef}
						playerRef={playerRef}
						stateManager={stateManager}
						trackItem={trackItem}
						loaded={loaded}
						isLargeScreen={isLargeScreen}
					/>
				)}
			</div>
		</div>
	);
};

export default Editor;
