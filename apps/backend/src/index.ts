import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { uploadsRoutes } from "./routes/uploads.ts";
import { renderRoutes } from "./routes/render.ts";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });

await app.register(uploadsRoutes, { prefix: "/api/uploads" });
await app.register(renderRoutes, { prefix: "/api/render" });

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT) || 3001;
await app.listen({ port, host: "0.0.0.0" });
