import type { Redis } from "ioredis";
import type { JobProgressPort } from "../../../application/ports/outbound/JobProgressPort.ts";

const progressKey = (jobId: string): string => `job:progress:${jobId}`;

export class RedisJobProgressAdapter implements JobProgressPort {
	private readonly redis: Redis;
	private readonly ttlSeconds: number;

	constructor(redis: Redis, ttlSeconds: number) {
		this.redis = redis;
		this.ttlSeconds = ttlSeconds;
	}

	async setProgress(jobId: string, progress: number): Promise<void> {
		await this.redis.set(
			progressKey(jobId),
			JSON.stringify({ progress }),
			"EX",
			this.ttlSeconds,
		);
	}

	async getProgress(jobId: string): Promise<number | null> {
		const data = await this.redis.get(progressKey(jobId));
		if (!data) return null;
		const parsed = JSON.parse(data) as { progress: number };
		return parsed.progress ?? null;
	}

	async deleteProgress(jobId: string): Promise<void> {
		await this.redis.del(progressKey(jobId));
	}
}
