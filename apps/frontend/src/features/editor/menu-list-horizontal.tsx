import { Icons } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { MenuItem } from "./menu-item/menu-item";
import useLayoutStore from "./store/use-layout-store";

// Define menu item data structure
interface MenuItemData {
	id: string;
	label: string;
	icon: React.ComponentType<{ width?: number }>;
}

// Menu items configuration
const menuItems: MenuItemData[] = [
	{
		id: "texts",
		label: "טקסט",
		icon: Icons.type,
	},
	{
		id: "audios",
		label: "שמע",
		icon: Icons.audio,
	},
];

// Reusable MenuButton component
interface MenuButtonProps {
	item: MenuItemData;
	isActive: boolean;
	onClick: () => void;
}

function MenuButton({ item, isActive, onClick }: MenuButtonProps) {
	return (
		<Button
			onClick={onClick}
			variant={isActive ? "default" : "ghost"}
			size={"sm"}
			className="text-muted-foreground"
		>
			{item.label}
		</Button>
	);
}

export default function MenuListHorizontal() {
	const {
		setActiveMenuItem,
		setShowMenuItem,
		activeMenuItem,
		showMenuItem,
		drawerOpen,
		setDrawerOpen,
	} = useLayoutStore();

	const isLargeScreen = useIsLargeScreen();

	const handleMenuItemClick = (menuItem: string) => {
		setActiveMenuItem(menuItem as any);
		// Use drawer on mobile, sidebar on desktop
		if (!isLargeScreen) {
			setDrawerOpen(true);
		} else {
			setShowMenuItem(true);
		}
	};

	const isMenuItemActive = (itemId: string) => {
		return (
			(drawerOpen && activeMenuItem === itemId) ||
			(showMenuItem && activeMenuItem === itemId)
		);
	};

	return (
		<>
			<div className="flex h-12 items-center border-t">
				<ScrollArea className="w-full px-2">
					<div className="flex items-center justify-center space-x-4 min-w-max px-4">
						{menuItems.map((item) => (
							<MenuButton
								key={item.id}
								item={item}
								isActive={isMenuItemActive(item.id)}
								onClick={() => handleMenuItemClick(item.id)}
							/>
						))}
					</div>
				</ScrollArea>
			</div>

			{/* Drawer only on mobile/tablet - conditionally mounted */}
			{!isLargeScreen && (
				<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
					<DrawerContent className="max-h-[80vh] min-h-[340px] mt-0">
						<VisuallyHidden>
							<DrawerHeader>
								<DrawerTitle>אפשרויות תפריט</DrawerTitle>
								<DrawerDescription>
									בחר מאפשרויות התפריט הזמינות
								</DrawerDescription>
							</DrawerHeader>
						</VisuallyHidden>

						<div className="flex-1 overflow-auto">
							<MenuItem />
						</div>
					</DrawerContent>
				</Drawer>
			)}
		</>
	);
}
