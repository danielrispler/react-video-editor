import type {
	EditorPreviewItemAddedMessage,
	EditorPreviewItemRejectedMessage,
	EditorProjectClearedMessage,
	ParentToEditorMessage,
} from "./messages.js";
import { parentToEditorMessageSchema } from "./schemas.js";

export const isParentToEditorMessage = (
	value: unknown,
): value is ParentToEditorMessage =>
	parentToEditorMessageSchema.safeParse(value).success;

export const parseParentToEditorMessage = (value: unknown) =>
	parentToEditorMessageSchema.parse(value);

export const createPreviewItemAddedMessage = (
	itemId: string,
	requestId?: string,
): EditorPreviewItemAddedMessage => ({
	type: "EDITOR_PREVIEW_ITEM_ADDED",
	requestId,
	itemId,
});

export const createPreviewItemRejectedMessage = (
	reason: string,
	requestId?: string,
): EditorPreviewItemRejectedMessage => ({
	type: "EDITOR_PREVIEW_ITEM_REJECTED",
	requestId,
	reason,
});

export const createProjectClearedMessage = (
	requestId?: string,
): EditorProjectClearedMessage => ({
	type: "EDITOR_PROJECT_CLEARED",
	requestId,
});
