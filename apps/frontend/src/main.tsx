import { QueryProvider } from "@/components/query-provider";
import {
	BackgroundUploadRunner,
	StoreInitializer,
} from "@/components/store-initializer";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(
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
