import useStore from "../store/use-store";
import { useEffect, useRef, useState } from "react";
import { Droppable } from "@/components/ui/droppable";
import { Loader2, PlusIcon } from "lucide-react";
import { DroppableArea } from "./droppable";
import useUploadStore from "../store/use-upload-store";

const SceneEmpty = () => {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [desiredSize, setDesiredSize] = useState({ width: 0, height: 0 });
  const { size } = useStore();
  const { addPendingUploads, processUploads } = useUploadStore();

  useEffect(() => {
    const container = containerRef.current!;
    const PADDING = 96;
    const containerHeight = container.clientHeight - PADDING;
    const containerWidth = container.clientWidth - PADDING;
    const { width, height } = size;

    const desiredZoom = Math.min(
      containerWidth / width,
      containerHeight / height
    );
    setDesiredSize({
      width: width * desiredZoom,
      height: height * desiredZoom
    });
    setIsLoading(false);
  }, [size]);

  const onSelectFiles = (files: File[]) => {
    const fileUploads = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      type: f.type,
      status: "pending" as const,
      progress: 0
    }));

    addPendingUploads(fileUploads);
    setTimeout(() => {
      processUploads();
    }, 0);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 flex h-full w-full flex-1 dark:bg-card/80 bg-card"
    >
      {!isLoading ? (
        <Droppable
          maxFileCount={10}
          maxSize={50 * 1024 * 1024}
          accept={{
            "video/*": [],
            "image/*": [],
            "audio/*": []
          }}
          disabled={false}
          onValueChange={onSelectFiles}
          className="h-full w-full flex-1"
        >
          <DroppableArea
            onDragStateChange={setIsDraggingOver}
            className={`absolute h-[calc(100%-40px)] bg-card aspect-[9/16] left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 transform items-center justify-center border border-dashed text-center transition-colors duration-200 ease-in-out ${
              isDraggingOver ? "border-border bg-white/10" : "border-border"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-4 pb-12">
              <div className="hover:bg-primary-dark cursor-pointer rounded-md border bg-primary p-2 text-secondary transition-colors duration-200">
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-px">
                <p className="text-sm text-muted-foreground">Click to upload</p>
                <p className="text-xs text-muted-foreground/70">
                  Or drag and drop files here
                </p>
              </div>
            </div>
          </DroppableArea>
        </Droppable>
      ) : (
        <div className="fixed top-0 left-0 z-50 flex h-screen w-screen flex-col items-center justify-center gap-4 bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      )}
    </div>
  );
};

export default SceneEmpty;
