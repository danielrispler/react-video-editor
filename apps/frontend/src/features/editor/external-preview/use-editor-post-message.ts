import { dispatch } from "@designcombo/events";
import { ADD_AUDIO, ADD_VIDEO } from "@designcombo/state";
import StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import { ITrackItem } from "@designcombo/types";
import {
	type EditorPreviewItemAddedMessage,
	type EditorPreviewItemRejectedMessage,
	type EditorProjectClearedMessage,
	type EditorToParentMessage,
	type ParentToEditorMessage,
	type PreviewItemPayload,
	createPreviewItemAddedMessage,
	createPreviewItemRejectedMessage,
	createProjectClearedMessage,
	parentToEditorMessageSchema,
} from "@video-editor/iframe-contract";
import { useEffect, useMemo, useRef } from "react";
import { resolvePreviewSource } from "./preview-source-api";
import {
	MAX_PREVIEW_DURATION_MS,
	isLikelyAudioPlaylistSrc,
	isSafeMediaUrl,
	parseAllowedOrigins,
} from "./utils";

type ResponseCacheEntry =
	| EditorPreviewItemAddedMessage
	| EditorPreviewItemRejectedMessage
	| EditorProjectClearedMessage;

type ExternalMetadata = {
	sourceKind: "hls" | "mp4" | "audio";
	externalKind: "recording-range" | "media" | "audio-range";
	channelId?: string;
	mediaId?: string;
	audioId?: string;
	sourceStartTimeMs?: number;
	sourceEndTimeMs?: number;
	sourceDurationMs?: number;
	sourceOffsetMs?: number;
	posterSrc?: string;
};

const getProjectDuration = (stateManager: StateManager) => {
	const state = stateManager.getState();
	const trackItems = Object.values(state.trackItemsMap || {}) as ITrackItem[];
	const maxDisplayTo = trackItems.reduce((max, item) => {
		const displayTo = item.display?.to ?? 0;
		return Math.max(max, displayTo);
	}, 0);

	return Math.max(state.duration || 0, maxDisplayTo);
};

const getDurationFromItem = (item: ITrackItem) => {
	const displayDuration = (item.display?.to ?? 0) - (item.display?.from ?? 0);
	return Math.max(item.duration || 0, displayDuration, 0);
};

const buildExternalMetadata = (
	payload: PreviewItemPayload,
): ExternalMetadata => {
	if (payload.kind === "recording-range") {
		return {
			sourceKind: "hls",
			externalKind: "recording-range",
			channelId: payload.channelId,
			sourceStartTimeMs: payload.startTimeMs,
			sourceEndTimeMs: payload.endTimeMs,
			sourceDurationMs: payload.durationMs,
			sourceOffsetMs: payload.sourceOffsetMs ?? 0,
			posterSrc: payload.posterSrc,
		};
	}

	if (payload.kind === "media") {
		return {
			sourceKind: payload.playback.kind,
			externalKind: "media",
			mediaId: payload.mediaId,
			sourceDurationMs: payload.durationMs,
			posterSrc: payload.posterSrc,
		};
	}

	return {
		sourceKind: payload.playback.kind,
		externalKind: "audio-range",
		audioId: payload.audioId,
		sourceStartTimeMs: payload.startTimeMs,
		sourceEndTimeMs: payload.endTimeMs,
		sourceDurationMs: payload.durationMs,
		sourceOffsetMs: payload.sourceOffsetMs ?? 0,
	};
};

const validatePayloadBusinessRules = (
	payload: PreviewItemPayload,
): string | null => {
	// recording-range may omit playback — the editor resolves it via the preview-source API
	if (payload.kind === "recording-range" && !payload.playback) {
		return null;
	}

	const src = payload.playback!.src;
	if (!isSafeMediaUrl(src)) {
		return "Invalid src URL";
	}

	if (payload.kind === "recording-range" && payload.playback!.kind !== "hls") {
		return "recording-range playback.kind must be hls";
	}

	if (
		payload.kind === "media" &&
		payload.playback.kind !== "mp4" &&
		payload.playback.kind !== "hls"
	) {
		return "media playback.kind must be mp4 or hls";
	}

	if (
		payload.kind === "audio-range" &&
		payload.playback.kind !== "audio" &&
		payload.playback.kind !== "hls"
	) {
		return "audio-range playback.kind must be audio or hls";
	}

	if (
		payload.kind === "audio-range" &&
		payload.playback.kind !== "hls" &&
		!isLikelyAudioPlaylistSrc(src)
	) {
		return "audio-range src must point to audio or HLS media";
	}

	if (
		payload.durationMs !== undefined &&
		payload.durationMs > MAX_PREVIEW_DURATION_MS
	) {
		return "durationMs exceeds the maximum supported preview duration";
	}

	return null;
};

const buildFallbackTrackItem = (
	itemId: string,
	insertAtMs: number,
	payload: PreviewItemPayload,
	metadata: ExternalMetadata,
	src: string,
	sourceOffsetMs: number,
): ITrackItem => {
	if (payload.kind === "audio-range") {
		return {
			id: itemId,
			type: "audio",
			name: "audio",
			display: {
				from: insertAtMs,
				to: insertAtMs + payload.durationMs,
			},
			trim: {
				from: sourceOffsetMs,
				to: sourceOffsetMs + payload.durationMs,
			},
			duration: payload.durationMs,
			details: {
				src,
			},
			metadata: {
				previewUrl: "",
				...metadata,
			},
		} as ITrackItem;
	}

	return {
		id: itemId,
		type: "video",
		name: "video",
		display: {
			from: insertAtMs,
			to: insertAtMs + (payload.durationMs ?? 0),
		},
		trim: {
			from: payload.kind === "recording-range" ? sourceOffsetMs : 0,
			to:
				payload.kind === "recording-range"
					? sourceOffsetMs + payload.durationMs
					: (payload.durationMs ?? 0),
		},
		duration: payload.durationMs,
		details: {
			src,
		},
		metadata: {
			previewUrl: payload.posterSrc || "",
			...metadata,
		},
	} as unknown as ITrackItem;
};

const appendItemState = (
	stateManager: StateManager,
	itemId: string,
	insertAtMs: number,
	payload: PreviewItemPayload,
	metadata: ExternalMetadata,
	fallbackItem: ITrackItem,
	sourceOffsetMsOverride?: number,
) => {
	const state = stateManager.getState();
	const currentItem = (state.trackItemsMap[itemId] as ITrackItem | undefined)
		? (state.trackItemsMap[itemId] as ITrackItem)
		: fallbackItem;
	const currentDuration =
		payload.kind === "media" && payload.durationMs === undefined
			? getDurationFromItem(currentItem)
			: payload.durationMs;

	const resolvedDuration = Math.max(currentDuration || 0, 0);
	const trimFrom =
		payload.kind === "recording-range" || payload.kind === "audio-range"
			? (sourceOffsetMsOverride ?? payload.sourceOffsetMs ?? 0)
			: (currentItem.trim?.from ?? 0);
	const trimTo =
		payload.kind === "recording-range" || payload.kind === "audio-range"
			? trimFrom + payload.durationMs
			: payload.kind === "media" && resolvedDuration > 0
				? trimFrom + resolvedDuration
				: (currentItem.trim?.to ?? trimFrom);
	const displayDuration =
		resolvedDuration > 0 ? resolvedDuration : getDurationFromItem(currentItem);
	const displayTo =
		displayDuration > 0
			? insertAtMs + displayDuration
			: (currentItem.display?.to ?? insertAtMs);

	const nextTrackItemsMap = {
		...state.trackItemsMap,
		[itemId]: {
			...currentItem,
			display: {
				from: insertAtMs,
				to: displayTo,
			},
			trim: {
				from: trimFrom,
				to: trimTo,
			},
			duration: resolvedDuration > 0 ? resolvedDuration : currentItem.duration,
			metadata: {
				...(currentItem.metadata || {}),
				...metadata,
				previewUrl:
					metadata.posterSrc || currentItem.metadata?.previewUrl || "",
			},
		},
	};

	stateManager.updateState(
		{
			trackItemsMap: nextTrackItemsMap,
			duration: Object.values(nextTrackItemsMap).reduce((max, trackItem) => {
				const displayTo = trackItem.display?.to ?? 0;
				return Math.max(max, displayTo);
			}, 0),
		},
		{
			updateHistory: false,
			kind: "update",
		},
	);
};

const addPreviewItemToEditor = async (
	stateManager: StateManager,
	payload: PreviewItemPayload,
) => {
	const itemId = generateId();
	const insertAtMs = getProjectDuration(stateManager);
	const metadata = buildExternalMetadata(payload);

	if (payload.kind === "recording-range") {
		let hlsSrc: string;
		let resolvedSourceOffsetMs = payload.sourceOffsetMs ?? 0;

		if (payload.playback?.src) {
			// Fast path: Angular pre-resolved the HLS URL
			hlsSrc = payload.playback.src;
		} else {
			// Editor resolves HLS URL via POST /api/editor/preview-source
			const resolved = await resolvePreviewSource(
				payload.channelId,
				payload.startTimeMs,
				payload.endTimeMs,
			);
			hlsSrc = resolved.playlistUrl;
			// Use backend-computed sourceOffsetMs if not provided by the parent
			if (payload.sourceOffsetMs === undefined) {
				resolvedSourceOffsetMs = resolved.sourceOffsetMs;
			}
		}

		dispatch(ADD_VIDEO, {
			payload: {
				id: itemId,
				type: "video",
				name: "video",
				display: {
					from: insertAtMs,
					to: insertAtMs + payload.durationMs,
				},
				trim: {
					from: resolvedSourceOffsetMs,
					to: resolvedSourceOffsetMs + payload.durationMs,
				},
				duration: payload.durationMs,
				details: {
					src: hlsSrc,
				},
				metadata: {
					previewUrl: payload.posterSrc || "",
					...metadata,
				},
			},
			options: {
				resourceId: "main",
				scaleMode: "fit",
				isSelected: false,
			},
		});
		appendItemState(
			stateManager,
			itemId,
			insertAtMs,
			payload,
			metadata,
			buildFallbackTrackItem(
				itemId,
				insertAtMs,
				payload,
				metadata,
				hlsSrc,
				resolvedSourceOffsetMs,
			),
			resolvedSourceOffsetMs,
		);
		return itemId;
	}

	if (payload.kind === "media") {
		dispatch(ADD_VIDEO, {
			payload: {
				id: itemId,
				type: "video",
				name: "video",
				display:
					payload.durationMs !== undefined
						? {
								from: insertAtMs,
								to: insertAtMs + payload.durationMs,
							}
						: undefined,
				trim:
					payload.durationMs !== undefined
						? {
								from: 0,
								to: payload.durationMs,
							}
						: undefined,
				duration: payload.durationMs,
				details: {
					src: payload.playback.src,
				},
				metadata: {
					previewUrl: payload.posterSrc || "",
					...metadata,
				},
			},
			options: {
				resourceId: "main",
				scaleMode: "fit",
				isSelected: false,
			},
		});
		appendItemState(
			stateManager,
			itemId,
			insertAtMs,
			payload,
			metadata,
			buildFallbackTrackItem(
				itemId,
				insertAtMs,
				payload,
				metadata,
				payload.playback.src,
				0,
			),
		);
		return itemId;
	}

	dispatch(ADD_AUDIO, {
		payload: {
			id: itemId,
			type: "audio",
			name: "audio",
			display: {
				from: insertAtMs,
				to: insertAtMs + payload.durationMs,
			},
			trim: {
				from: payload.sourceOffsetMs ?? 0,
				to: (payload.sourceOffsetMs ?? 0) + payload.durationMs,
			},
			duration: payload.durationMs,
			details: {
				src: payload.playback.src,
			},
			metadata: {
				previewUrl: "",
				...metadata,
			},
		},
		options: {
			isSelected: false,
		},
	});
	appendItemState(
		stateManager,
		itemId,
		insertAtMs,
		payload,
		metadata,
		buildFallbackTrackItem(
			itemId,
			insertAtMs,
			payload,
			metadata,
			payload.playback.src,
			payload.sourceOffsetMs ?? 0,
		),
	);
	return itemId;
};

const clearProject = (stateManager: StateManager) => {
	const currentState = stateManager.getState();
	stateManager.updateState(
		{
			...currentState,
			tracks: [],
			trackItemIds: [],
			trackItemsMap: {},
			transitionIds: [],
			transitionsMap: {},
			structure: [],
			activeIds: [],
			duration: 0,
		},
		{
			updateHistory: false,
			kind: "design:load",
		},
	);
};

export const useEditorPostMessage = (stateManager: StateManager) => {
	const responseCacheRef = useRef<Map<string, ResponseCacheEntry>>(new Map());
	const MAX_RESPONSE_CACHE_SIZE = 100;
	const allowedOrigins = useMemo(() => {
		const envOrigins = parseAllowedOrigins(
			import.meta.env.VITE_EDITOR_PARENT_ORIGINS,
		);
		envOrigins.add(window.location.origin);
		return envOrigins;
	}, []);

	useEffect(() => {
		const setCached = (requestId: string, response: ResponseCacheEntry) => {
			const cache = responseCacheRef.current;
			if (cache.size >= MAX_RESPONSE_CACHE_SIZE) {
				const firstKey = cache.keys().next().value;
				if (firstKey !== undefined) cache.delete(firstKey);
			}
			cache.set(requestId, response);
		};

		const postResponse = (
			source: MessageEventSource | null,
			targetOrigin: string,
			message: EditorToParentMessage,
		) => {
			if (!source || typeof source.postMessage !== "function") {
				return;
			}
			source.postMessage(message, { targetOrigin });
		};

		const reject = (
			source: MessageEventSource | null,
			targetOrigin: string,
			requestId: string | undefined,
			reason: string,
		) => {
			const response: EditorPreviewItemRejectedMessage =
				createPreviewItemRejectedMessage(reason, requestId);
			if (requestId) {
				setCached(requestId, response);
			}
			postResponse(source, targetOrigin, response);
		};

		const handleMessage = async (event: MessageEvent) => {
			if (!allowedOrigins.has(event.origin)) {
				return;
			}

			const rawRequestId =
				typeof event.data === "object" &&
				event.data !== null &&
				"requestId" in event.data &&
				typeof event.data.requestId === "string"
					? event.data.requestId
					: undefined;

			const parsed = parentToEditorMessageSchema.safeParse(event.data);
			if (!parsed.success) {
				reject(
					event.source,
					event.origin,
					rawRequestId,
					parsed.error.issues[0]?.message || "Invalid message payload",
				);
				return;
			}

			const message: ParentToEditorMessage = parsed.data;
			if (message.requestId) {
				const cachedResponse = responseCacheRef.current.get(message.requestId);
				if (cachedResponse) {
					postResponse(event.source, event.origin, cachedResponse);
					return;
				}
			}

			if (message.type === "EDITOR_CLEAR_PROJECT") {
				try {
					clearProject(stateManager);
					const response: EditorProjectClearedMessage =
						createProjectClearedMessage(message.requestId);
					if (message.requestId) {
						setCached(message.requestId, response);
					}
					postResponse(event.source, event.origin, response);
				} catch (error) {
					reject(
						event.source,
						event.origin,
						message.requestId,
						error instanceof Error ? error.message : "Failed to clear project",
					);
				}
				return;
			}

			const ruleViolation = validatePayloadBusinessRules(message.payload);
			if (ruleViolation) {
				reject(event.source, event.origin, message.requestId, ruleViolation);
				return;
			}

			try {
				const itemId = await addPreviewItemToEditor(
					stateManager,
					message.payload,
				);
				const response: EditorPreviewItemAddedMessage =
					createPreviewItemAddedMessage(itemId, message.requestId);
				if (message.requestId) {
					setCached(message.requestId, response);
				}
				postResponse(event.source, event.origin, response);
			} catch (error) {
				reject(
					event.source,
					event.origin,
					message.requestId,
					error instanceof Error ? error.message : "Failed to add preview item",
				);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, [allowedOrigins, stateManager]);
};
