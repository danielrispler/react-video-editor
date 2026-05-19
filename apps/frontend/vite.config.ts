import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: process.env.VITE_API_URL || "http://localhost:4001",
				changeOrigin: true,
			},
		},
	},
});
