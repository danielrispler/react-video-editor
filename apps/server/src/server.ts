import cors from '@fastify/cors';
import redis from '@fastify/redis';
import ffmpeg from 'fluent-ffmpeg';
import { envPlugin } from './config/env';
import { editVideoRouter } from './edit-video/edit-video.routes';
import { createFastifyInstance, TypedFastify } from './fastify/fastify';
import { getFfmpegPath } from './ffmpeg/ffmpeg.utils';
import { storagePlugin } from './plugins/storage.plugin';
import { uploadRouter } from './upload/upload.routes';

export class Server {
    private app: TypedFastify;

    constructor() {
        this.app = createFastifyInstance();
    }

    async start(): Promise<void> {
        ffmpeg.setFfmpegPath(getFfmpegPath());
        await this.app.register(envPlugin);
        await this.app.register(storagePlugin);
        await this.app.register(cors, { origin: true });
        await this.app.register(redis, {
            host: this.app.config.REDIS_HOST,
            port: this.app.config.REDIS_PORT,
            password: this.app.config.REDIS_PASSWORD || undefined,
        });
        await this.app.register(editVideoRouter, { prefix: '/api' });
        await this.app.register(uploadRouter, { prefix: '/api' });

        try {
            await this.app.listen({
                port: this.app.config.PORT,
                host: this.app.config.HOST,
            });

            if (this.app.config.S3_AUTO_CREATE_BUCKET) {
                try {
                    await this.app.storage.ensureBucketExists();
                    this.app.log.info(`S3 bucket '${this.app.config.S3_BUCKET}' ready`);
                } catch (err) {
                    this.app.log.warn(err, 'Could not ensure S3 bucket exists; uploads may fail');
                }
            }

            console.log(`✓ Ready to process videos`);
        } catch (err) {
            this.app.log.error(err);
            process.exit(1);
        }
    }

    stop = async (): Promise<void> => await this.app.close();
};