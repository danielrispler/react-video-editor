import type { FastifyPluginAsync } from "fastify";

export const transcribeRoutes: FastifyPluginAsync = async (app) => {
	app.post("/", async (request, reply) => {
		try {
			const res = await fetch("https://api.designcombo.dev/v1/audios/speech-to-text", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${process.env.COMBO_SK}`,
				},
				body: JSON.stringify(request.body),
			});
			const data = (await res.json()) as any;
			if (!res.ok) return reply.status(res.status).send({ message: data?.message ?? "Failed" });
			return reply.send(data);
		} catch (err) {
			app.log.error({ err });
			return reply.status(500).send({ message: "Internal server error" });
		}
	});
};
