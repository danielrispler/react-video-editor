import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import {
	StoreInitializer,
	BackgroundUploadRunner,
} from "@/components/store-initializer";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<ThemeProvider
			attribute="class"
			defaultTheme="light"
			enableSystem
			disableTransitionOnChange
		>
			<QueryProvider>
				<App />
				<StoreInitializer />
				<BackgroundUploadRunner />
				<Toaster />
			</QueryProvider>
		</ThemeProvider>
	</BrowserRouter>,
);
