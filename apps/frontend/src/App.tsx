import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import EditPage from "@/pages/EditPage";

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<Home />} />
			<Route path="/edit" element={<EditPage />} />
			<Route path="/edit/:id" element={<EditPage />} />
		</Routes>
	);
}
