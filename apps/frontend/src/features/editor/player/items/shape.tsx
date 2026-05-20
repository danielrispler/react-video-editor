import { BoxAnim, ContentAnim, MaskAnim } from "@designcombo/animations";
import type { IShape } from "@designcombo/types";
import { calculateFrames } from "../../utils/frames";
import { getAnimations } from "../../utils/get-animations";
import { BaseSequence, type SequenceItemOptions } from "../base-sequence";
import { calculateContainerStyles } from "../styles";

export const Shape = ({
	item,
	options,
}: {
	item: IShape;
	options: SequenceItemOptions;
}) => {
	const { fps, frame } = options;
	const { details, animations } = item;
	const { animationIn, animationOut, animationTimed } = getAnimations(
		animations!,
		item,
		frame,
		fps,
	);
	const { durationInFrames } = calculateFrames(item.display, fps);
	const currentFrame = (frame || 0) - (item.display.from * fps) / 1000;
	const children = (
		<BoxAnim
			style={calculateContainerStyles(details)}
			animationIn={animationIn}
			animationOut={animationOut}
			frame={currentFrame}
			durationInFrames={durationInFrames}
		>
			<ContentAnim
				animationTimed={animationTimed}
				durationInFrames={durationInFrames}
				frame={currentFrame}
				style={calculateContainerStyles(details)}
			>
				<MaskAnim
					item={item}
					keyframeAnimations={animationTimed}
					frame={frame || 0}
				>
					<div
						style={{
							width: "100%",
							height: "100%",
							color: (details as any).backgroundColor || "#ffffff",
						}}
						dangerouslySetInnerHTML={{ __html: details.src }}
					/>
				</MaskAnim>
			</ContentAnim>
		</BoxAnim>
	);
	return BaseSequence({ item, options, children });
};

export default Shape;
