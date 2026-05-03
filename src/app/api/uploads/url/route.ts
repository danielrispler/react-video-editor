import { NextRequest, NextResponse } from "next/server";
import { sanitizeFileName, uploadBufferToStorage } from "@/lib/storage";

interface UploadUrlRequest {
  userId: string;
  urls: string[];
}

interface UploadedUrlResponse {
  fileName: string;
  filePath: string;
  contentType: string;
  originalUrl: string;
  folder?: string;
  url: string;
}

function getFileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const fromPath = parsed.pathname.split("/").pop();
    return sanitizeFileName(fromPath || "remote-file");
  } catch {
    return "remote-file";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadUrlRequest = await request.json();
    const { userId, urls } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "urls array is required and must not be empty" },
        { status: 400 }
      );
    }

    const uploads: UploadedUrlResponse[] = await Promise.all(
      urls.map(async (url) => {
        const remoteResponse = await fetch(url);

        if (!remoteResponse.ok) {
          throw new Error(
            `Failed to fetch remote asset: ${url} (${remoteResponse.status})`
          );
        }

        const contentType =
          remoteResponse.headers.get("content-type") ||
          "application/octet-stream";
        const fileName = getFileNameFromUrl(url);
        const body = Buffer.from(await remoteResponse.arrayBuffer());

        const uploaded = await uploadBufferToStorage({
          userId,
          fileName,
          contentType,
          body
        });

        return {
          ...uploaded,
          originalUrl: url
        };
      })
    );

    return NextResponse.json({
      success: true,
      uploads
    });
  } catch (error) {
    console.error("Error in upload URL route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
