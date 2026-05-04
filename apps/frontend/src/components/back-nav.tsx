import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BackNav() {
	const navigate = useNavigate();

	return (
		<Button
			onClick={() => navigate(-1)}
			variant={"outline"}
			className="absolute left-4 top-4 w-8 md:left-8 md:top-8"
		>
			<ArrowLeftIcon />
		</Button>
	);
}
