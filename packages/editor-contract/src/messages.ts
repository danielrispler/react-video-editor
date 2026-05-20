import type { PreviewItemPayload } from "./payloads.js";

export type EditorAddPreviewItemMessage = {
	type: "EDITOR_ADD_PREVIEW_ITEM";
	requestId?: string;
	payload: PreviewItemPayload;
};

export type EditorClearProjectMessage = {
	type: "EDITOR_CLEAR_PROJECT";
	requestId?: string;
};

export type ParentToEditorMessage =
	| EditorAddPreviewItemMessage
	| EditorClearProjectMessage;

export type EditorPreviewItemAddedMessage = {
	type: "EDITOR_PREVIEW_ITEM_ADDED";
	requestId?: string;
	itemId: string;
};

export type EditorPreviewItemRejectedMessage = {
	type: "EDITOR_PREVIEW_ITEM_REJECTED";
	requestId?: string;
	reason: string;
};

export type EditorProjectClearedMessage = {
	type: "EDITOR_PROJECT_CLEARED";
	requestId?: string;
};

export type EditorReadyMessage = {
	type: "EDITOR_READY";
};

export type EditorToParentMessage =
	| EditorPreviewItemAddedMessage
	| EditorPreviewItemRejectedMessage
	| EditorProjectClearedMessage
	| EditorReadyMessage;
