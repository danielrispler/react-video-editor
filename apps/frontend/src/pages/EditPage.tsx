import Editor from "@/features/editor";
import { useParams } from "react-router-dom";

export default function EditPage() {
	const { id } = useParams();
	return <Editor id={id} />;
}
