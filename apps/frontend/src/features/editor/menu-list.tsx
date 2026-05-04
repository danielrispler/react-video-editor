import { Icons } from "@/components/shared/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import useLayoutStore from "./store/use-layout-store";

// Define menu items configuration for better maintainability
const MENU_ITEMS = [
	{
		id: "uploads",
		icon: Icons.upload,
		label: "Uploads",
		ariaLabel: "Add and manage uploads",
	},
	{
		id: "texts",
		icon: Icons.type,
		label: "Texts",
		ariaLabel: "Add and edit text elements",
	},
	{
		id: "audios",
		icon: Icons.audio,
		label: "Audio",
		ariaLabel: "Add and manage audio content",
	},
	{
		id: "transitions",
		icon: Icons.transition, // Custom SVG for transitions
		label: "Transitions",
		ariaLabel: "Add transition effects",
	},
] as const;

// Memoized menu button component for better performance
const MenuButton = memo<{
	item: (typeof MENU_ITEMS)[number];
	isActive: boolean;
	onClick: (menuItem: string) => void;
}>(({ item, isActive, onClick }) => {
	const handleClick = useCallback(() => {
		onClick(item.id);
	}, [item.id, onClick]);

	const IconComponent = item.icon;

	return (
		<div
			onClick={handleClick}
			className={cn(
				"flex items-center justify-center flex-none h-7.5 w-7.5 cursor-pointer rounded-sm transition-all duration-200",
				isActive
					? "bg-white/10 text-white"
					: "text-muted-foreground hover:bg-white/5 hover:text-white",
			)}
			key={item.id}
		>
			<Tooltip delayDuration={10}>
				<TooltipTrigger asChild>
					<IconComponent width={20} height={20} />
				</TooltipTrigger>
				<TooltipContent side="right" align="center" sideOffset={8}>
					{item.label}
				</TooltipContent>
			</Tooltip>
		</div>
	);
});

MenuButton.displayName = "MenuButton";

// Main MenuList component
function MenuList() {
	const {
		setActiveMenuItem,
		setShowMenuItem,
		activeMenuItem,
		showMenuItem,
		drawerOpen,
		setDrawerOpen,
	} = useLayoutStore();

	const isLargeScreen = useIsLargeScreen();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [showLeftFade, setShowLeftFade] = useState(false);
	const [showRightFade, setShowRightFade] = useState(false);

	const handleMenuItemClick = useCallback(
		(menuItem: string) => {
			setActiveMenuItem(menuItem as any);
			// Use drawer on mobile, sidebar on desktop
			if (!isLargeScreen) {
				setDrawerOpen(true);
			} else {
				setShowMenuItem(true);
			}
		},
		[isLargeScreen, setActiveMenuItem, setDrawerOpen, setShowMenuItem],
	);

	const checkScrollPosition = () => {
		const element = scrollRef.current;
		if (!element) return;

		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowLeftFade(scrollTop > 0);
		setShowRightFade(scrollTop < scrollHeight - clientHeight - 1);
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

	return (
		<>
			<div className="relative flex h-full w-16 flex-none flex-col items-center gap-2 border-r border-border/80 bg-primary/7 px-2 py-3">
				{showLeftFade && (
					<div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-8 bg-linear-to-b from-card to-transparent" />
				)}
				<div
					ref={scrollRef}
					className="scrollbar-hidden! h-full w-full overflow-y-auto overflow-x-hidden"
				>
					<div className="flex w-full flex-col items-center gap-2 py-1">
						{MENU_ITEMS.map((item) => {
							const isActive =
								(drawerOpen && activeMenuItem === item.id) ||
								(showMenuItem && activeMenuItem === item.id);
							return (
								<MenuButton
									key={item.id}
									item={item}
									isActive={isActive}
									onClick={handleMenuItemClick}
								/>
							);
						})}
					</div>
				</div>

				{showRightFade && (
					<div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-8 bg-linear-to-t from-card to-transparent" />
				)}
			</div>

			{/* Drawer only on mobile/tablet - conditionally mounted */}
		</>
	);
}

export default memo(MenuList);
