import { PlayerRef, Player as RemotionPlayer } from "@remotion/player";
import { useEffect, useRef } from "react";
import useStore from "../store/use-store";
import Composition from "./composition";

const Player = () => {
	const playerRef = useRef<PlayerRef>(null);
	const { setPlayerRef, duration, fps, size, background } = useStore();

	useEffect(() => {
		setPlayerRef(playerRef as React.RefObject<PlayerRef>);
	}, []);

	return (
		<RemotionPlayer
			ref={playerRef}
			component={Composition}
			durationInFrames={Math.round((duration / 1000) * fps) || 1}
			compositionWidth={size.width}
			compositionHeight={size.height}
			className={`h-full w-full bg-[${background.value}]`}
			fps={30}
			overflowVisible
		/>
	);
};
export default Player;
