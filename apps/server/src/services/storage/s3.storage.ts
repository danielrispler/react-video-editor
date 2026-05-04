import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./storage.types.ts";

export interface S3StorageConfig {
	bucket: string;
	region: string;
	endpoint: string;
	forcePathStyle: boolean;
	accessKeyId: string;
	secretAccessKey: string;
}

export class S3Storage implements StorageProvider {
	protected client: S3Client;
	private readonly bucket: string;

	constructor(s3Config: S3StorageConfig) {
		this.bucket = s3Config.bucket;
		this.client = new S3Client({
			region: s3Config.region,
			endpoint: s3Config.endpoint,
			forcePathStyle: s3Config.forcePathStyle,
			credentials: {
				accessKeyId: s3Config.accessKeyId,
				secretAccessKey: s3Config.secretAccessKey,
			},
		});
	}

	public uploadStream = async (
		stream: Readable,
		key: string,
		contentType?: string,
	): Promise<void> => {
		const upload = new Upload({
			client: this.client,
			params: {
				Bucket: this.bucket,
				Key: key,
				Body: stream,
				ContentType: contentType,
			},
		});

		await upload.done();
	};

	protected downloadFile = async (
		key: string,
		outputPath: string,
	): Promise<void> => {
		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: key,
		});

		const response = await this.client.send(command);

		if (!response.Body) {
			throw new Error(`Failed to download file from S3: ${key}`);
		}

		await pipeline(response.Body as Readable, fs.createWriteStream(outputPath));
	};

	private extractKeyFromUrlOrKey = (urlOrKey: string): string => {
		const url = new URL(urlOrKey);
		const parts = url.pathname.replace(/^\/+/, "").split("/");

		return parts.slice(1).join("/");
	};

	public downloadToFile = async (
		urlOrKey: string,
		outputPath: string,
	): Promise<void> =>
		this.downloadFile(this.extractKeyFromUrlOrKey(urlOrKey), outputPath);

	public getPresignedUrl = async (
		key: string,
		expiresIn = 3600,
	): Promise<string> => {
		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: key,
		});

		return getSignedUrl(this.client, command, { expiresIn });
	};

	public getPresignedUploadUrl = async (
		key: string,
		contentType?: string,
		expiresIn = 3600,
	): Promise<string> => {
		const command = new PutObjectCommand({
			Bucket: this.bucket,
			Key: key,
			ContentType: contentType,
		});

		return getSignedUrl(this.client, command, { expiresIn });
	};

	public deleteFile = async (key: string): Promise<void> => {
		const command = new DeleteObjectCommand({
			Bucket: this.bucket,
			Key: key,
		});

		await this.client.send(command);
	};

	protected fileExists = async (key: string): Promise<boolean> => {
		try {
			const command = new HeadObjectCommand({
				Bucket: this.bucket,
				Key: key,
			});
			await this.client.send(command);
			return true;
		} catch {
			return false;
		}
	};

	public ensureBucketExists = async (): Promise<void> => {
		try {
			await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
			return;
		} catch {
			/* bucket does not exist, create it */
		}
		await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
	};
}
