import { TypeBoxTypeProvider, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify, { FastifyBaseLogger, FastifyInstance, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault, RouteGenericInterface } from "fastify";
import { StatusCodes } from "http-status-codes";

export type registerRouter = (fastify: TypedFastify) => void | Promise<void>;

export type Request<
    Body = unknown,
    Querystring = unknown,
    Params = unknown,
    Headers = unknown
> = FastifyRequest<RouteGenericInterface & {
    Body: Body;
    Querystring: Querystring;
    Params: Params;
    Headers: Headers;
}>;

export type TypedFastify = FastifyInstance<RawServerDefault, RawRequestDefaultExpression,
    RawReplyDefaultExpression, FastifyBaseLogger, TypeBoxTypeProvider>;

export const createFastifyInstance = (): TypedFastify => {
    const app = Fastify({
        logger: true,
    }).withTypeProvider<TypeBoxTypeProvider>();
    app.setValidatorCompiler(TypeBoxValidatorCompiler);

    app.setErrorHandler((error: Error & { validation?: unknown }, _request, reply) => {
        if ('validation' in error && error.validation) {
            return reply.status(StatusCodes.BAD_REQUEST).send({
                error: 'Invalid payload',
                details: error.validation
            });
        }

        return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: error.message });
    });

    return app;
};