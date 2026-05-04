import { ScrollArea } from "@/components/ui/scroll-area";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import { IAudio, ITrackItem } from "@designcombo/types";
import React, { useState } from "react";
import Speed from "./common/speed";
import Volume from "./common/volume";

const BasicAudio = ({
	trackItem,
	type,
}: {
	trackItem: ITrackItem & IAudio;
	type?: string;
}) => {
	const showAll = !type;
	const [properties, setProperties] = useState(trackItem);

	const handleChangeVolume = (v: number) => {
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					details: {
						volume: v,
					},
				},
			},
		});

		setProperties((prev) => {
			return {
				...prev,
				details: {
					...prev.details,
					volume: v,
				},
			};
		});
	};

	const handleChangeSpeed = (v: number) => {
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					playbackRate: v,
				},
			},
		});

		setProperties((prev) => {
			return {
				...prev,
				playbackRate: v,
			};
		});
	};

	const components = [
		{
			key: "speed",
			component: (
				<Speed
					value={properties.playbackRate ?? 1}
					onChange={handleChangeSpeed}
				/>
			),
		},
		{
			key: "volume",
			component: (
				<Volume
					onChange={(v: number) => handleChangeVolume(v)}
					value={properties.details.volume ?? 100}
				/>
			),
		},
	];

	return (
		<div className="flex flex-1 flex-col">
			<ScrollArea className="h-full">
				<div className="flex flex-col gap-2 px-4 py-4">
					{components
						.filter((comp) => showAll || comp.key === type)
						.map((comp) => (
							<React.Fragment key={comp.key}>{comp.component}</React.Fragment>
						))}
				</div>
			</ScrollArea>
		</div>
	);
};

export default BasicAudio;
