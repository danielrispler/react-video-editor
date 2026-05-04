import { create } from "zustand";
import { IDataState } from "../interfaces/editor";

const useDataState = create<IDataState>((set) => ({
	fonts: [],
	compactFonts: [],
	setFonts: (fonts) => set({ fonts }),
	setCompactFonts: (compactFonts) => set({ compactFonts }),
}));

export default useDataState;
