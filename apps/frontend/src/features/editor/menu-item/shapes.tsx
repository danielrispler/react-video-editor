import { ScrollArea } from "@/components/ui/scroll-area";
import { dispatch } from "@designcombo/events";
import { ADD_SHAPE } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";

const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const SHAPES = [
	{
		id: "circle",
		label: "עיגול",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="6"/></svg>`,
		previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="white" stroke-width="6"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "square",
		label: "ריבוע",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect x="3" y="3" width="94" height="94" rx="6" fill="none" stroke="currentColor" stroke-width="6"/></svg>`,
		previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="3" y="3" width="94" height="94" rx="6" fill="none" stroke="white" stroke-width="6"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "triangle",
		label: "משולש",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><polygon points="50,4 97,96 3,96" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/></svg>`,
		previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,4 97,96 3,96" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "arrow",
		label: "חץ",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100%" height="100%"><polygon points="2,18 58,18 58,3 98,30 58,57 58,42 2,42" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`,
		previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><polygon points="2,18 58,18 58,3 98,30 58,57 58,42 2,42" fill="none" stroke="white" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 120,
		height: 72,
	},
	{
		id: "star",
		label: "כוכב",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`,
		previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="none" stroke="white" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "heart",
		label: "לב",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><path d="M50,85 C50,85 10,60 10,30 C10,15 22,5 35,5 C42,5 48,9 50,13 C52,9 58,5 65,5 C78,5 90,15 90,30 C90,60 50,85 50,85 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`,
		previewSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,85 C50,85 10,60 10,30 C10,15 22,5 35,5 C42,5 48,9 50,13 C52,9 58,5 65,5 C78,5 90,15 90,30 C90,60 50,85 50,85 Z" fill="none" stroke="white" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
].map((s) => ({ ...s, dataUrl: svgToDataUrl(s.previewSvg) }));

export const Shapes = () => {
	const handleAddShape = (shape: (typeof SHAPES)[0]) => {
		dispatch(ADD_SHAPE, {
			payload: {
				id: generateId(),
				type: "shape",
				display: { from: 0, to: 5000 },
				details: {
					src: shape.svg,
					path: "",
					width: shape.width,
					height: shape.height,
					backgroundColor: "#ffffff",
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

	return (
		<div className="flex flex-1 flex-col">
			<div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
				צורות
			</div>
			<ScrollArea className="flex-1 h-[calc(100%-48px)]">
				<div className="grid grid-cols-2 gap-3 px-4 py-2">
					{SHAPES.map((shape) => (
						<button
							key={shape.id}
							type="button"
							onClick={() => handleAddShape(shape)}
							className="flex flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-secondary p-4 cursor-pointer hover:border-zinc-500 hover:bg-zinc-700"
						>
							<img
								src={shape.dataUrl}
								alt={shape.label}
								style={{ width: 56, height: 56, objectFit: "contain" }}
							/>
							<span className="text-xs text-muted-foreground">
								{shape.label}
							</span>
						</button>
					))}
				</div>
			</ScrollArea>
		</div>
	);
};

export default Shapes;
