import { useIsLargeScreen } from "@/hooks/use-media-query";
import type {
	IAudio,
	ICaption,
	IImage,
	IText,
	ITrackItem,
	ITrackItemAndDetails,
	IVideo,
} from "@designcombo/types";
import { useEffect, useState } from "react";
import { MenuItem } from "../menu-item";
import useLayoutStore from "../store/use-layout-store";
import useStore from "../store/use-store";
import BasicAudio from "./basic-audio";
import BasicCaption from "./basic-caption";
import BasicImage from "./basic-image";
import BasicText from "./basic-text";
import BasicVideo from "./basic-video";

const ActiveControlItem = ({
	trackItem,
}: {
	trackItem?: ITrackItemAndDetails;
}) => {
	if (!trackItem) {
		return null;
	}
	return (
		<>
			{
				{
					text: <BasicText trackItem={trackItem as ITrackItem & IText} />,
					caption: (
						<BasicCaption trackItem={trackItem as ITrackItem & ICaption} />
					),
					image: <BasicImage trackItem={trackItem as ITrackItem & IImage} />,
					video: <BasicVideo trackItem={trackItem as ITrackItem & IVideo} />,
					audio: <BasicAudio trackItem={trackItem as ITrackItem & IAudio} />,
				}[trackItem.type as "text"]
			}
		</>
	);
};

export const ControlItem = () => {
	const { activeIds, trackItemsMap } = useStore();
	const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);
	const { setTrackItem: setLayoutTrackItem, showMenuItem } = useLayoutStore();
	const isLargeScreen = useIsLargeScreen();

	useEffect(() => {
		if (activeIds.length === 1) {
			const [id] = activeIds;
			const item = trackItemsMap[id];
			if (item) {
				setTrackItem(item);
				setLayoutTrackItem(item);
			} else {
				setTrackItem(null);
				setLayoutTrackItem(null);
			}
		} else {
			setTrackItem(null);
			setLayoutTrackItem(null);
		}
	}, [activeIds, trackItemsMap, setLayoutTrackItem]);

	if (!isLargeScreen) return null;
	if (!trackItem && !showMenuItem) return null;

	return (
		<div className="h-full min-w-0 flex-1 overflow-hidden border-l border-border/80 bg-card">
			{trackItem ? <ActiveControlItem trackItem={trackItem} /> : <MenuItem />}
		</div>
	);
};
