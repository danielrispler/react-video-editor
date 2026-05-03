import { dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import { ADD_VIDEO } from "@designcombo/state";

export function getUploadAssetUrl(upload: any) {
  return upload?.metadata?.uploadedUrl || upload?.url || "";
}

export function autoAddUploadedVideo(upload: any) {
  const src = getUploadAssetUrl(upload);

  if (!src) return;

  dispatch(ADD_VIDEO, {
    payload: {
      id: generateId(),
      details: {
        src
      },
      metadata: {
        previewUrl: ""
      }
    },
    options: {
      resourceId: "main",
      scaleMode: "fit"
    }
  });
}
