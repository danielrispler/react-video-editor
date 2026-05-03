import { useParams } from "react-router-dom";
import Editor from "@/features/editor";

export default function EditPage() {
	const { id } = useParams();
	return <Editor id={id} />;
}
