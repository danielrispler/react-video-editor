import { Type } from '@sinclair/typebox';

export const errorResponseSchema = Type.Object({
    error: Type.String()
});

export const getSignedUrlBodySchema = Type.Object({
    filename: Type.String({ minLength: 1 }),
    mimetype: Type.String({ minLength: 1 }),
});

export const getSignedUrlResponseSchema = Type.Object({
    uploadUrl: Type.String(),
    s3Key: Type.String(),
    filename: Type.String(),
    publicUrl: Type.String(),
});

export const getSignedUrlRequestSchema = {
    body: getSignedUrlBodySchema,
    response: {
        200: getSignedUrlResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema
    }
};

export const cleanupBodySchema = Type.Object({
    s3Keys: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })
});

export const cleanupResponseSchema = Type.Object({
    deleted: Type.Number(),
    deletedFiles: Type.Array(Type.String()),
    errors: Type.Optional(Type.Array(Type.String()))
});

export const cleanupRequestSchema = {
    body: cleanupBodySchema,
    response: {
        200: cleanupResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema
    }
};

export type GetSignedUrlRequest = import('@sinclair/typebox').Static<typeof getSignedUrlBodySchema>;
export type CleanupRequest = import('@sinclair/typebox').Static<typeof cleanupBodySchema>;