import type { FastifyPluginAsync } from "fastify";

export const transcribeRoutes: FastifyPluginAsync = async (app) => {
	app.post("/", async (request, reply) => {
		try {
			const body = request.body;

			const response = await fetch(
				"https://api.designcombo.dev/v1/audios/speech-to-text",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${process.env.COMBO_SK}`,
					},
					body: JSON.stringify(body),
				},
			);

			const responseData = await response.json() as any;

			if (!response.ok) {
				return reply
					.status(response.status)
					.send({ message: responseData?.message || "Failed convert audio to text" });
			}

			return reply.send(responseData);
		} catch (error) {
			app.log.error({ err: error });
			return reply.status(500).send({ message: "Internal server error" });
		}
	});
};
