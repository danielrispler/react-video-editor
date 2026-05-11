import type StateManager from "@designcombo/state";
import type { IAudio, ITrackItem, IVideo } from "@designcombo/types";
import { useEffect, useRef } from "react";
import { audioDataManager } from "../player/lib/audio-data";
import useStore from "../store/use-store";

export const useStateManagerEvents = (stateManager: StateManager) => {
	const setStateRef = useRef(useStore.getState().setState);

	// Keep ref current without causing re-subscriptions
	useEffect(() => {
		setStateRef.current = useStore.getState().setState;
	});

	useEffect(() => {
		const setState = (s: any) => setStateRef.current(s);

		const handleTrackItemUpdate = () => {
			const currentState = stateManager.getState();
			const filterTrackItems = Object.values(
				currentState.trackItemsMap,
			).filter(
				(item) => item.type === "video" || item.type === "audio",
			) as (ITrackItem & (IVideo | IAudio))[];

			audioDataManager.setItems(filterTrackItems);
			audioDataManager.validateUpdateItems(filterTrackItems);
			setState({
				duration: currentState.duration,
				trackItemsMap: currentState.trackItemsMap,
			});
		};

		const handleAddRemoveItems = () => {
			const currentState = stateManager.getState();
			const filterTrackItems = Object.values(
				currentState.trackItemsMap,
			).filter(
				(item) => item.type === "video" || item.type === "audio",
			) as (ITrackItem & (IVideo | IAudio))[];

			audioDataManager.validateUpdateItems(filterTrackItems);
			setState({
				trackItemsMap: currentState.trackItemsMap,
				trackItemIds: currentState.trackItemIds,
				tracks: currentState.tracks,
			});
		};

		const handleUpdateItemDetails = () => {
			const currentState = stateManager.getState();
			setState({ trackItemsMap: currentState.trackItemsMap });
		};

		// Subscribe to all state changes — each returns an unsubscribable
		const subs = [
			stateManager.subscribeToUpdateStateDetails((newState) =>
				setState(newState),
			),
			stateManager.subscribeToScale((newState) => setState(newState)),
			stateManager.subscribeToState((newState) => setState(newState)),
			stateManager.subscribeToDuration((newState) => setState(newState)),
			stateManager.subscribeToUpdateTrackItem(handleTrackItemUpdate),
			stateManager.subscribeToAddOrRemoveItems(handleAddRemoveItems),
			stateManager.subscribeToUpdateItemDetails(handleUpdateItemDetails),
		];

		return () => {
			for (const sub of subs) sub.unsubscribe();
		};
	}, [stateManager]);
};
