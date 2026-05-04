import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { uploadsRoutes } from "./routes/uploads.ts";
import { renderRoutes } from "./routes/render.ts";
import { pexelsRoutes } from "./routes/pexels.ts";
import { voicesRoutes } from "./routes/voices.ts";
import { transcribeRoutes } from "./routes/transcribe.ts";
import { exportRoutes } from "./routes/export.ts";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });

await app.register(uploadsRoutes, { prefix: "/api/uploads" });
await app.register(renderRoutes, { prefix: "/api/render" });
await app.register(pexelsRoutes, { prefix: "/api" });
await app.register(voicesRoutes, { prefix: "/api/voices" });
await app.register(transcribeRoutes, { prefix: "/api/transcribe" });
await app.register(exportRoutes, { prefix: "/api/export" });

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT) || 3001;
await app.listen({ port, host: "0.0.0.0" });
