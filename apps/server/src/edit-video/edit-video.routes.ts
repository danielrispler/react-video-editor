import type { FastifyInstance } from 'fastify';
import { editVideoRequestSchema } from './edit-video.schema.ts';
import { EditVideoHandler } from './edit-video.handler.ts';

export const editVideoRouter = (fastify: FastifyInstance): void => {
    const handler = EditVideoHandler();
    fastify.post('/edit-video', { schema: { body: editVideoRequestSchema } }, handler.editVideo);
    fastify.get('/edit-video/progress/:jobId', handler.getJobProgress);
};
