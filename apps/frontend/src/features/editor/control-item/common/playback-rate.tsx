import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import type { ITrackItem } from "@designcombo/types";

const RATES = [
	{ value: 0.5, label: "x0.5", tooltip: "מהירות האטה" },
	{ value: 1, label: "x1", tooltip: "מהירות רגילה" },
	{ value: 1.5, label: "x1.5", tooltip: "מהירות מהירה" },
	{ value: 2, label: "x2", tooltip: "מהירות כפולה" },
];

export default function PlaybackRate({ trackItem }: { trackItem: ITrackItem }) {
	const handleChangePlaybackRate = (value: number) => {
		dispatch(EDIT_OBJECT, {
			payload: {
				[trackItem.id]: {
					playbackRate: value,
				},
			},
		});
	};
	return (
		<div className="flex flex-col gap-2 py-4">
			<Label className="font-sans text-xs font-semibold">מהירות הפעלה</Label>
			<div className="flex">
				{RATES.map(({ value, label, tooltip }) => (
					<Tooltip key={value}>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								onClick={() => handleChangePlaybackRate(value)}
							>
								{label}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{tooltip}</TooltipContent>
					</Tooltip>
				))}
			</div>
		</div>
	);
}
