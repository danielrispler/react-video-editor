import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { download, getExportFilename } from "@/utils/download";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { CircleCheckIcon } from "lucide-react";
import { useDownloadState } from "./store/use-download-state";

const DownloadProgressModal = () => {
	const { progress, displayProgressModal, output, exporting, error, actions } =
		useDownloadState();
	const isCompleted = Boolean(output?.url) && !exporting;
	const isFailed = Boolean(error) && !exporting && !isCompleted;
	const exportLabel = output?.type === "webp" ? "התמונה" : "הסרטון";

	const handleDownload = async () => {
		if (output?.url) {
			await download(output.url, getExportFilename(output.type));
		}
	};
	return (
		<Dialog
			open={displayProgressModal}
			onOpenChange={actions.setDisplayProgressModal}
		>
			<DialogContent className="flex h-[627px] flex-col gap-0 bg-background p-0 sm:max-w-[844px]">
				<DialogTitle className="hidden" />
				<DialogDescription className="hidden" />
				<div className="flex h-16 items-center border-b px-4 font-medium">
					הורדה
				</div>
				{isCompleted ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 space-y-4">
						<div className="flex flex-col items-center space-y-1 text-center">
							<div className="font-semibold">
								<CircleCheckIcon />
							</div>
							<div className="font-bold">יוצא בהצלחה</div>
							<div className="text-muted-foreground">
								ניתן להוריד את {exportLabel} למכשירך.
							</div>
						</div>
						<Button onClick={handleDownload}>הורדה</Button>
					</div>
				) : isFailed ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
						<div className="font-bold">הייצוא נכשל</div>
						<div className="text-sm text-zinc-500">{error}</div>
					</div>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-4">
						<div className="text-5xl font-semibold">
							{Math.floor(progress)}%
						</div>
						<div className="font-bold">מייצא...</div>
						<div className="text-center text-zinc-500">
							<div>סגירת הדפדפן לא תבטל את הייצוא.</div>
							<div>הסרטון יישמר במרחב שלך.</div>
						</div>
						<Button variant={"outline"}>ביטול</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default DownloadProgressModal;
