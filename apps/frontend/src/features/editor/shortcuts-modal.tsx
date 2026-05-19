import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ShortcutsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
	label: string;
	keys: string[];
	disabled?: boolean;
}

interface ShortcutCategory {
	title: string;
	items: ShortcutItem[];
}

const SHORTCUTS: ShortcutCategory[] = [
	{
		title: "כללי",
		items: [
			{ label: "בחר הכל", keys: ["⌘", "A"] },
			{
				label: "בחר מספר קליפים",
				keys: ["⇧", "Left-Click"],
			},
			{ label: "העתק", keys: ["⌘", "C"] },
			{ label: "גזור", keys: ["⌘", "X"] },
			{ label: "הדבק", keys: ["⌘", "V"] },
			{ label: "מחק", keys: ["⌫"] },
			{ label: "בטל", keys: ["⌘", "Z"] },
			{ label: "בצע שוב", keys: ["⇧", "⌘", "Z"] },
			{ label: "הפעל או השהה", keys: ["Space"] },
			{ label: "גלישת טקסט", keys: ["⌘", "Enter"], disabled: true },
			{ label: "פצל משפט", keys: ["Enter"], disabled: true },
		],
	},
	{
		title: "ציר זמן",
		items: [
			{ label: "פצל", keys: ["⌘", "B"] },
			{ label: "הגדל", keys: ["⌘", "+"] },
			{ label: "הקטן", keys: ["⌘", "-"] },
			{ label: "גלול למעלה או למטה", keys: ["Scroll"], disabled: true },
			{ label: "גלול שמאלה או ימינה", keys: ["⇧", "Scroll"], disabled: true },
			{ label: "פריים ראשון", keys: ["⌘", "←"] },
			{ label: "פריים הבא", keys: ["⌘", "→"] },
			{ label: "הפעל/כבה ציר תצוגה מקדימה", keys: ["S"], disabled: true },
			{ label: "עגן", keys: ["N"], disabled: true },
			{
				label: "הפרד או שחזר שמע",
				keys: ["⇧", "⌘", "S"],
				disabled: true,
			},
			{ label: "הוסף או הסר פעימות", keys: ["M"], disabled: true },
		],
	},
	{
		title: "קנבס",
		items: [
			{ label: "מסך מלא", keys: ["⇧", "⌘", "F"], disabled: true },
			{ label: "הזז", keys: ["V"], disabled: true },
			{ label: "כלי יד", keys: ["H"], disabled: true },
			{ label: "הגדל", keys: ["⇧", "+"], disabled: true },
			{ label: "הקטן", keys: ["⇧", "-"], disabled: true },
			{ label: "התאם לתצוגה", keys: ["⇧", "F"], disabled: true },
			{ label: "זום 50%", keys: ["⇧", "0"], disabled: true },
			{ label: "זום 100%", keys: ["⇧", "1"], disabled: true },
			{ label: "זום 200%", keys: ["⇧", "2"], disabled: true },
			{ label: "הזז למעלה פיקסל", keys: ["↑"] },
			{ label: "הזז למטה פיקסל", keys: ["↓"] },
			{ label: "הזז שמאלה פיקסל", keys: ["←"] },
			{ label: "הזז ימינה פיקסל", keys: ["→"] },
			{ label: "הזז 5 פיקסלים", keys: ["⇧", "Arrow Keys"] },
		],
	},
];

export function ShortcutsModal({ open, onOpenChange }: ShortcutsModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="md:max-w-5xl w-full max-w-5xl border bg-card p-6 py-8 overflow-hidden">
				<DialogHeader className="px-6">
					<DialogTitle className="text-lg font-semibold">
						קיצורי דרך
					</DialogTitle>
				</DialogHeader>
				<div className="px-6">
					<div className="grid grid-cols-3 gap-8">
						{SHORTCUTS.map((category, index) => (
							<div
								key={category.title}
								className="flex flex-col gap-6 relative"
							>
								<h3 className="text-sm font-semibold">{category.title}</h3>
								<div className="flex flex-col gap-5">
									{category.items.map((item) => (
										<div
											key={item.label}
											className={cn(
												"flex items-center justify-between text-sm",
												item.disabled ? "opacity-40" : "",
											)}
										>
											<span className="text-zinc-300">{item.label}</span>
											<div className="flex gap-5">
												{item.keys.map((key, i) => (
													<Kbd
														key={i}
														className="bg-zinc-800 border-zinc-700 text-zinc-300 min-w-6"
													>
														{key}
													</Kbd>
												))}
											</div>
										</div>
									))}
								</div>
								{index < SHORTCUTS.length - 1 && (
									<>
										<div className="md:hidden">
											<Separator className="my-4 bg-zinc-800" />
										</div>
										<div className="hidden md:block absolute -right-4 top-0 bottom-0 w-[1px] bg-zinc-800" />
									</>
								)}
							</div>
						))}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
