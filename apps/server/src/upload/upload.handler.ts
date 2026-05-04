import type { FastifyReply } from 'fastify';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ALLOWED_MIMES } from './upload.consts';
import { Request } from '../fastify/fastify';
import { GetSignedUrlRequest, CleanupRequest } from './upload.schema';
import { StorageProvider } from '../services/storage/storage.types';
import { StatusCodes } from 'http-status-codes';

export interface UploadHandler {
    getSignedUrl: (request: Request<GetSignedUrlRequest>, reply: FastifyReply) => Promise<FastifyReply>;
    cleanup: (request: Request<CleanupRequest>, reply: FastifyReply) => Promise<FastifyReply>;
}

export const UploadHandler = (storage: StorageProvider, uploadPrefix: string): UploadHandler => {
    return {
        getSignedUrl: async (
            request: Request<GetSignedUrlRequest>,
            reply: FastifyReply
        ) => {
            console.log('[getSignedUrl] Handler entered, body:', JSON.stringify(request.body));
            const { filename, mimetype } = request.body;

            const ext = path.extname(filename).toLowerCase();
            const isMpd = ext === '.mpd';

            if (!ALLOWED_MIMES.includes(mimetype) && !isMpd) {
                return reply.status(StatusCodes.BAD_REQUEST).send({
                    error: `File type not allowed: ${mimetype}. Allowed types: ${ALLOWED_MIMES.join(', ')}`
                });
            }

            const generatedFilename = `${uuidv4()}${ext}`;
            const s3Key = `${uploadPrefix}/${generatedFilename}`;

            try {
                const uploadUrl = await storage.getPresignedUploadUrl(s3Key, mimetype);
                const publicUrl = await storage.getPresignedUrl(s3Key);

                const responseData = {
                    uploadUrl,
                    s3Key,
                    filename: generatedFilename,
                    publicUrl
                };
                console.log('[getSignedUrl] Responding with:', JSON.stringify(responseData));
                return reply.status(StatusCodes.OK).send(responseData);
            } catch (err) {
                console.error('[getSignedUrl] Error:', err);
                return reply.status(500).send({ error: err instanceof Error ? err.message : 'Unknown error' });
            }
        },
        cleanup: async (
            request: Request<CleanupRequest>,
            reply: FastifyReply
        ) => {
            const { s3Keys } = request.body;

            if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
                return reply.status(400).send({ error: 's3Keys array is required' });
            }

            const deletedFiles: string[] = [];
            const errors: string[] = [];

            for (const s3Key of s3Keys) {
                try {
                    await storage.deleteFile(s3Key);
                    deletedFiles.push(s3Key);
                } catch (err) {
                    errors.push(`Failed to delete S3 file ${s3Key}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }

            return reply.status(200).send({
                deleted: deletedFiles.length,
                deletedFiles,
                errors: errors.length > 0 ? errors : undefined
            });
        }
    };
};
