import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { createJob, getJob, startRender } from "../lib/ffmpeg.ts";
import type { Design } from "../lib/ffmpeg.ts";

interface StartBody {
	design: Design;
}

interface JobParams {
	jobId: string;
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
	// ── POST / — start render job ─────────────────────────────────────────────
	app.post<{ Body: StartBody }>("/", async (request, reply) => {
		const { design } = request.body;

		if (!design || typeof design !== "object") {
			return reply.status(400).send({ error: "design is required" });
		}

		if (!design.tracks || !design.fps || !design.duration) {
			return reply.status(400).send({ error: "invalid design: missing tracks, fps, or duration" });
		}

		const job = createJob();
		app.log.info({ jobId: job.id, designId: design.id }, "Render job created");

		// Fire-and-forget — render runs in background
		startRender(job, design);

		return reply.status(202).send({
			jobId: job.id,
			status: job.status,
		});
	});

	// ── GET /:jobId — poll status ─────────────────────────────────────────────
	app.get<{ Params: JobParams }>("/:jobId", async (request, reply) => {
		const job = getJob(request.params.jobId);

		if (!job) {
			return reply.status(404).send({ error: "job not found" });
		}

		return {
			jobId: job.id,
			status: job.status,
			progress: job.progress,
			error: job.error ?? null,
		};
	});

	// ── GET /:jobId/file — download completed MP4 ─────────────────────────────
	app.get<{ Params: JobParams }>("/:jobId/file", async (request, reply) => {
		const job = getJob(request.params.jobId);

		if (!job) {
			return reply.status(404).send({ error: "job not found" });
		}

		if (job.status === "failed") {
			return reply.status(500).send({ error: job.error ?? "render failed" });
		}

		if (job.status !== "done" || !job.outputPath) {
			return reply.status(409).send({
				error: "render not complete",
				status: job.status,
				progress: job.progress,
			});
		}

		try {
			const stats = await stat(job.outputPath);

			return reply
				.header("Content-Type", "video/mp4")
				.header("Content-Disposition", `attachment; filename="export.mp4"`)
				.header("Content-Length", stats.size)
				.send(createReadStream(job.outputPath));
		} catch {
			return reply.status(500).send({ error: "output file not readable" });
		}
	});
};
