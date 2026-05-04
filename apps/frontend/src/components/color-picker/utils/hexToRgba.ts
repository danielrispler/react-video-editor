export default (hexVal: string, opacityVal: number) => {
	const opacity = Number.isNaN(opacityVal) ? 100 : opacityVal;
	const hex = hexVal.replace("#", "");
	let r = 0;
	let g = 0;
	let b = 0;

	if (hex.length === 6) {
		r = Number.parseInt(hex.substring(0, 2), 16);
		g = Number.parseInt(hex.substring(2, 4), 16);
		b = Number.parseInt(hex.substring(4, 6), 16);
	} else {
		const rd = hex.substring(0, 1) + hex.substring(0, 1);
		const gd = hex.substring(1, 2) + hex.substring(1, 2);
		const bd = hex.substring(2, 3) + hex.substring(2, 3);
		r = Number.parseInt(rd, 16);
		g = Number.parseInt(gd, 16);
		b = Number.parseInt(bd, 16);
	}

	return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};
