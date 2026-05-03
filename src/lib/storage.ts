import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_BUCKET = "react-video-editor";
const DEFAULT_SERVER_ENDPOINT = "http://127.0.0.1:9000";
const DEFAULT_PUBLIC_URL = "http://localhost:9000";

function getEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function getStorageConfig() {
  return {
    bucket: getEnv("S3_BUCKET", DEFAULT_BUCKET),
    region: getEnv("S3_REGION", DEFAULT_REGION),
    endpoint: getEnv("S3_ENDPOINT", DEFAULT_SERVER_ENDPOINT),
    publicUrl: getEnv("S3_PUBLIC_URL", DEFAULT_PUBLIC_URL),
    accessKeyId: getEnv("S3_ACCESS_KEY", "minioadmin"),
    secretAccessKey: getEnv("S3_SECRET_KEY", "minioadmin"),
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false"
  };
}

export function createS3Client() {
  const config = getStorageConfig();

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .split("/")
    .pop()
    ?.replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";
}

export function buildObjectKey(userId: string, fileName: string) {
  const safeUserId = sanitizeFileName(userId);
  const safeFileName = sanitizeFileName(fileName);
  return `${safeUserId}/${randomUUID()}-${safeFileName}`;
}

export function getPublicObjectUrl(filePath: string) {
  const { bucket, publicUrl } = getStorageConfig();
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${publicUrl.replace(/\/$/, "")}/${trimSlashes(bucket)}/${encodedPath}`;
}

export async function createPresignedUpload({
  userId,
  fileName,
  contentType
}: {
  userId: string;
  fileName: string;
  contentType?: string;
}) {
  const client = createS3Client();
  const { bucket } = getStorageConfig();
  const filePath = buildObjectKey(userId, fileName);
  const resolvedContentType = contentType || "application/octet-stream";

  const presignedUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      ContentType: resolvedContentType
    }),
    { expiresIn: 900 }
  );

  return {
    fileName: sanitizeFileName(fileName),
    filePath,
    contentType: resolvedContentType,
    presignedUrl,
    folder: userId,
    url: getPublicObjectUrl(filePath)
  };
}

export async function uploadBufferToStorage({
  userId,
  fileName,
  contentType,
  body
}: {
  userId: string;
  fileName: string;
  contentType?: string;
  body: Buffer;
}) {
  const client = createS3Client();
  const { bucket } = getStorageConfig();
  const filePath = buildObjectKey(userId, fileName);
  const resolvedContentType = contentType || "application/octet-stream";

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: body,
      ContentType: resolvedContentType
    })
  );

  return {
    fileName: sanitizeFileName(fileName),
    filePath,
    contentType: resolvedContentType,
    folder: userId,
    url: getPublicObjectUrl(filePath)
  };
}
