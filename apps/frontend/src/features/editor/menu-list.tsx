import { Icons } from "@/components/shared/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { dispatch } from "@designcombo/events";
import { ADD_SHAPE, ADD_TEXT } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { nanoid } from "nanoid";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { TEXT_ADD_PAYLOAD } from "./constants/payload";
import useLayoutStore from "./store/use-layout-store";

const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const SHAPES_INLINE = [
	{
		id: "circle",
		label: "עיגול",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="6"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "square",
		label: "ריבוע",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="3" y="3" width="94" height="94" rx="6" fill="none" stroke="currentColor" stroke-width="6"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "triangle",
		label: "משולש",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,4 97,96 3,96" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "arrow",
		label: "חץ",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><polygon points="2,18 58,18 58,3 98,30 58,57 58,42 2,42" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 120,
		height: 72,
	},
	{
		id: "star",
		label: "כוכב",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
	{
		id: "heart",
		label: "לב",
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,85 C50,85 10,60 10,30 C10,15 22,5 35,5 C42,5 48,9 50,13 C52,9 58,5 65,5 C78,5 90,15 90,30 C90,60 50,85 50,85 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`,
		width: 80,
		height: 80,
	},
].map((s) => ({ ...s, dataUrl: svgToDataUrl(s.svg) }));

const UPLOAD_ITEM = {
	id: "uploads",
	icon: Icons.upload,
	label: "העלאות",
	ariaLabel: "הוסף ונהל העלאות",
} as const;

function MenuList() {
	const { setActiveMenuItem, setShowMenuItem, activeMenuItem, showMenuItem } =
		useLayoutStore();

	const scrollRef = useRef<HTMLDivElement>(null);
	const [showTopFade, setShowTopFade] = useState(false);
	const [showBottomFade, setShowBottomFade] = useState(false);
	const [shapesOpen, setShapesOpen] = useState(false);

	const handleAddText = useCallback(() => {
		dispatch(ADD_TEXT, {
			payload: { ...TEXT_ADD_PAYLOAD, id: nanoid() },
			options: {},
		});
	}, []);

	const handleAddShape = useCallback((shape: (typeof SHAPES_INLINE)[0]) => {
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
	}, []);

	const handleUploadsClick = useCallback(() => {
		setActiveMenuItem("uploads" as any);
		setShowMenuItem(true);
	}, [setActiveMenuItem, setShowMenuItem]);

	const checkScrollPosition = () => {
		const element = scrollRef.current;
		if (!element) return;
		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowTopFade(scrollTop > 0);
		setShowBottomFade(scrollTop < scrollHeight - clientHeight - 1);
	};

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		checkScrollPosition();
		element.addEventListener("scroll", checkScrollPosition);
		const resizeObserver = new ResizeObserver(checkScrollPosition);
		resizeObserver.observe(element);
		return () => {
			element.removeEventListener("scroll", checkScrollPosition);
			resizeObserver.disconnect();
		};
	}, []);

	const uploadsActive = showMenuItem && activeMenuItem === "uploads";

	return (
		<div className="relative flex h-full w-16 flex-none flex-col items-center gap-2 border-r border-border/80 bg-sidebar px-2 py-3">
			{showTopFade && (
				<div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 bg-linear-to-b from-card to-transparent" />
			)}
			<div
				ref={scrollRef}
				className="scrollbar-hidden! h-full w-full overflow-y-auto overflow-x-hidden"
			>
				<div className="flex w-full flex-col items-center gap-2 py-1">
					{/* Uploads */}
					<Tooltip delayDuration={10}>
						<TooltipTrigger asChild>
							<div
								onClick={handleUploadsClick}
								className={cn(
									"flex items-center justify-center flex-none h-7.5 w-7.5 cursor-pointer rounded-sm transition-all duration-200",
									uploadsActive
										? "bg-accent/25 text-foreground shadow-sm"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground",
								)}
							>
								<UPLOAD_ITEM.icon width={20} height={20} />
							</div>
						</TooltipTrigger>
						<TooltipContent side="right" align="center" sideOffset={8}>
							{UPLOAD_ITEM.label}
						</TooltipContent>
					</Tooltip>

					{/* Shapes toggle + inline grid */}
					<Tooltip delayDuration={10}>
						<TooltipTrigger asChild>
							<div
								onClick={() => setShapesOpen((v) => !v)}
								className={cn(
									"flex items-center justify-center flex-none h-7.5 w-7.5 cursor-pointer rounded-sm transition-all duration-200",
									shapesOpen
										? "bg-accent/25 text-foreground shadow-sm"
										: "text-muted-foreground hover:bg-secondary hover:text-foreground",
								)}
							>
								<Icons.shapes width={20} height={20} />
							</div>
						</TooltipTrigger>
						<TooltipContent side="right" align="center" sideOffset={8}>
							צורות
						</TooltipContent>
					</Tooltip>

					{shapesOpen && (
						<div className="grid grid-cols-2 gap-1 w-full">
							{SHAPES_INLINE.map((shape) => (
								<button
									key={shape.id}
									type="button"
									aria-label={shape.label}
									onClick={() => handleAddShape(shape)}
									className="flex h-7 w-full items-center justify-center rounded-sm transition-all duration-150 text-muted-foreground hover:bg-secondary hover:text-foreground"
								>
									<img
										src={shape.dataUrl}
										alt={shape.label}
										style={{ width: 18, height: 18, objectFit: "contain" }}
									/>
								</button>
							))}
						</div>
					)}

					{/* Text — immediate add */}
					<Tooltip delayDuration={10}>
						<TooltipTrigger asChild>
							<div
								onClick={handleAddText}
								className="flex items-center justify-center flex-none h-7.5 w-7.5 cursor-pointer rounded-sm transition-all duration-200 text-muted-foreground hover:bg-secondary hover:text-foreground font-bold text-sm"
							>
								<Icons.type width={20} height={20} />
							</div>
						</TooltipTrigger>
						<TooltipContent side="right" align="center" sideOffset={8}>
							טקסטים
						</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{showBottomFade && (
				<div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-8 bg-linear-to-t from-card to-transparent" />
			)}
		</div>
	);
}

export default memo(MenuList);
