import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import StateManager from "@designcombo/state";
import type { ITrackItem } from "@designcombo/types";
import { useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants/constants";
import { ControlItem } from "./control-item";
import ControlItemHorizontal from "./control-item-horizontal";
import FloatingControl from "./control-item/floating-controls/floating-control";
import CropModal from "./crop-modal/crop-modal";
import { FONTS } from "./data/fonts";
import { useEditorPostMessage } from "./external-preview/use-editor-post-message";
import useTimelineEvents from "./hooks/use-timeline-events";
import MenuList from "./menu-list";
import MenuListHorizontal from "./menu-list-horizontal";
import Navbar from "./navbar";
import Scene from "./scene";
import type { SceneRef } from "./scene/scene.types";
import useDataState from "./store/use-data-state";
import useLayoutStore from "./store/use-layout-store";
import useStore from "./store/use-store";
import Timeline from "./timeline";
import { getCompactFontData, loadFonts } from "./utils/fonts";

const stateManager = new StateManager({
	size: {
		width: 1080,
		height: 1920,
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
		<div className="relative flex h-full w-full flex-col bg-background">
			<div className="flex-1 relative overflow-hidden w-full h-full">
				<div className="flex h-full flex-1">
					<div className="flex-1 relative overflow-hidden w-full h-full">
						<CropModal />
						<Scene ref={sceneRef} stateManager={stateManager} />
					</div>
				</div>
			</div>

			<div className="w-full">
				{playerRef && <Timeline stateManager={stateManager} />}
			</div>

			{!isLargeScreen && !trackItem && loaded && <MenuListHorizontal />}
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
	const { activeIds, trackItemsMap, transitionsMap } = useStore();
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
	// useEffect(() => {
	//   dispatch(DESIGN_LOAD, { payload: design });
	// }, []);
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

		// Trigger zoom recalculation when timeline is resized
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
			} else console.log(transitionsMap[id]);
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
