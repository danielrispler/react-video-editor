import type { FastifyPluginAsync } from "fastify";

export const voicesRoutes: FastifyPluginAsync = async (app) => {
	app.post("/", async (request, reply) => {
		try {
			const body = request.body as any;
			const { limit = 20, page = 1, query = {} } = body;

			const formattedQuery: any = {};
			if (query.languages && query.languages.length > 0) {
				formattedQuery.languages = query.languages;
			}
			if (query.genders && query.genders.length > 0) {
				formattedQuery.genders = query.genders;
			}

			const response = await fetch(
				"https://dubbing-152153811339.us-central1.run.app/search-voices",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ limit, page, query: formattedQuery }),
				},
			);

			if (!response.ok) {
				throw new Error(
					`External API responded with status: ${response.status}`,
				);
			}

			const data = await response.json();
			return reply.send(data);
		} catch (error) {
			app.log.error({ err: error }, "Error fetching voices:");
			return reply.status(500).send({ error: "Failed to fetch voices" });
		}
	});
};
