import { FastifyPluginAsync } from 'fastify';
import { UploadHandler } from './upload.handler';
import { cleanupRequestSchema, getSignedUrlRequestSchema } from './upload.schema';

export const uploadRouter: FastifyPluginAsync = async (fastify): Promise<void> => {
  const handler = UploadHandler(fastify.storage, fastify.config.S3_UPLOAD_PREFIX);

  fastify.post('/upload/signed-url', { schema: getSignedUrlRequestSchema }, handler.getSignedUrl);
  fastify.post('/cleanup', { schema: cleanupRequestSchema }, handler.cleanup);
};

