import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { StorageProvider } from '../services/storage/storage.types.ts';
import { S3Storage } from '../services/storage/s3.storage.ts';

declare module 'fastify' {
    interface FastifyInstance {
        storage: StorageProvider;
    }
}

export const storagePlugin: FastifyPluginAsync = fp(async (fastify) => {
    const storage: StorageProvider = new S3Storage({
        bucket: fastify.config.S3_BUCKET,
        region: fastify.config.S3_REGION,
        endpoint: fastify.config.S3_ENDPOINT,
        forcePathStyle: fastify.config.S3_FORCE_PATH_STYLE,
        accessKeyId: fastify.config.S3_ACCESS_KEY_ID,
        secretAccessKey: fastify.config.S3_SECRET_ACCESS_KEY,
    });
    fastify.decorate('storage', storage);
}, { name: 'storage-plugin', dependencies: ['env-plugin'] });
