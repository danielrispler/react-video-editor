import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";

export default function AspectRatio() {
	const [value, setValue] = useState("locked");
	const onChangeAligment = (value: string) => {
		setValue(value);
	};
	return (
		<div className="flex gap-2">
			<div className="flex flex-1 items-center text-sm text-muted-foreground">
				נעל יחס
			</div>
			<div className="w-32">
				<ToggleGroup
					value={value}
					size="sm"
					className="grid h-8 grid-cols-2 text-sm"
					type="single"
					onValueChange={onChangeAligment}
					variant={"default"}
				>
					<ToggleGroupItem value="locked" aria-label="Toggle italic">
						כן
					</ToggleGroupItem>
					<ToggleGroupItem size="sm" value="unlocked" aria-label="Toggle left">
						לא
					</ToggleGroupItem>
				</ToggleGroup>
			</div>
		</div>
	);
}
