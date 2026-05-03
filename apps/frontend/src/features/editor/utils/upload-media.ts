import { dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO } from "@designcombo/state";

export function getUploadAssetUrl(upload: any) {
  return upload?.metadata?.uploadedUrl || upload?.url || "";
}

export function autoAddUploadedMedia(upload: any) {
  const src = getUploadAssetUrl(upload);
  const mediaType = upload?.type;

  if (!src || !mediaType) return;

  if (mediaType === "video" || mediaType?.startsWith?.("video/")) {
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
    return;
  }

  if (mediaType === "image" || mediaType?.startsWith?.("image/")) {
    dispatch(ADD_IMAGE, {
      payload: {
        id: generateId(),
        type: "image",
        display: {
          from: 0,
          to: 5000
        },
        details: {
          src
        },
        metadata: {}
      },
      options: {}
    });
    return;
  }

  if (mediaType === "audio" || mediaType?.startsWith?.("audio/")) {
    dispatch(ADD_AUDIO, {
      payload: {
        id: generateId(),
        type: "audio",
        details: {
          src
        },
        metadata: {}
      },
      options: {}
    });
  }
}
