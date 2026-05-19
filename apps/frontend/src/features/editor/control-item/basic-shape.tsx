import ColorPicker from "@/components/color-picker";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import type { IBoxShadow, IShape, ITrackItem } from "@designcombo/types";
import React, { useEffect, useState } from "react";
import Opacity from "./common/opacity";
import Outline from "./common/outline";
import Shadow from "./common/shadow";

const BasicShape = ({
	trackItem,
	type,
}: {
	trackItem: ITrackItem & IShape;
	type?: string;
}) => {
	const showAll = !type;
	const [properties, setProperties] = useState(trackItem);

	useEffect(() => {
		setProperties(trackItem);
	}, [trackItem]);

	const handleChangeColor = (color: string) => {
		dispatch(EDIT_OBJECT, {
			payload: { [trackItem.id]: { details: { backgroundColor: color } } },
		});
		setProperties((prev) => ({
			...prev,
			details: { ...prev.details, backgroundColor: color },
		}));
	};

	const handleChangeOpacity = (v: number) => {
		dispatch(EDIT_OBJECT, {
			payload: { [trackItem.id]: { details: { opacity: v } } },
		});
		setProperties((prev) => ({
			...prev,
			details: { ...prev.details, opacity: v },
		}));
	};

	const onChangeBorderWidth = (v: number) => {
		dispatch(EDIT_OBJECT, {
			payload: { [trackItem.id]: { details: { borderWidth: v } } },
		});
		setProperties((prev) => ({
			...prev,
			details: { ...prev.details, borderWidth: v } as any,
		}));
	};

	const onChangeBorderColor = (v: string) => {
		dispatch(EDIT_OBJECT, {
			payload: { [trackItem.id]: { details: { borderColor: v } } },
		});
		setProperties((prev) => ({
			...prev,
			details: { ...prev.details, borderColor: v } as any,
		}));
	};

	const onChangeBoxShadow = (boxShadow: IBoxShadow) => {
		dispatch(EDIT_OBJECT, {
			payload: { [trackItem.id]: { details: { boxShadow } } },
		});
		setProperties((prev) => ({
			...prev,
			details: { ...prev.details, boxShadow } as any,
		}));
	};

	const details = properties.details as any;

	const components = [
		{
			key: "basic",
			component: (
				<div className="flex flex-col gap-4">
					<Label className="font-sans text-xs font-semibold">צבע</Label>
					<div className="flex items-center justify-center pb-2">
						<ColorPicker
							value={details.backgroundColor ?? "#6366f1"}
							format="hex"
							gradient={false}
							solid={true}
							onChange={handleChangeColor}
							allowAddGradientStops={false}
						/>
					</div>
					<Opacity
						onChange={handleChangeOpacity}
						value={details.opacity ?? 100}
					/>
				</div>
			),
		},
		{
			key: "outline",
			component: (
				<>
					<Outline
						label="מסגרת"
						onChageBorderWidth={onChangeBorderWidth}
						onChangeBorderColor={onChangeBorderColor}
						valueBorderWidth={details.borderWidth ?? 0}
						valueBorderColor={details.borderColor ?? "#000000"}
					/>
					<Shadow
						label="צל"
						onChange={onChangeBoxShadow}
						value={
							details.boxShadow ?? {
								color: "transparent",
								x: 0,
								y: 0,
								blur: 0,
							}
						}
					/>
				</>
			),
		},
	];

	return (
		<div className="flex lg:h-[calc(100vh-84px)] flex-1 flex-col overflow-hidden min-h-[340px]">
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

export default BasicShape;
