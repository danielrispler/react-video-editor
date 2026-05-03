import { NextRequest, NextResponse } from "next/server";
import { createPresignedUpload } from "@/lib/storage";

interface PresignRequest {
  userId: string;
  fileNames: string[];
  contentTypes?: string[];
}

interface PresignedUploadResponse {
  fileName: string;
  filePath: string;
  contentType: string;
  presignedUrl: string;
  folder?: string;
  url: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PresignRequest = await request.json();
    const { userId, fileNames, contentTypes } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return NextResponse.json(
        { error: "fileNames array is required and must not be empty" },
        { status: 400 }
      );
    }

    const uploads: PresignedUploadResponse[] = await Promise.all(
      fileNames.map((fileName, index) =>
        createPresignedUpload({
          userId,
          fileName,
          contentType: contentTypes?.[index]
        })
      )
    );

    return NextResponse.json({
      success: true,
      uploads
    });
  } catch (error) {
    console.error("Error in presign route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
