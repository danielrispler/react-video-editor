import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToStorage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId");
    const file = formData.get("file");

    if (typeof userId !== "string" || !userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    const uploaded = await uploadBufferToStorage({
      userId,
      fileName: file.name,
      contentType: file.type,
      body: Buffer.from(await file.arrayBuffer())
    });

    return NextResponse.json({
      success: true,
      upload: uploaded
    });
  } catch (error) {
    console.error("Error in file upload route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
