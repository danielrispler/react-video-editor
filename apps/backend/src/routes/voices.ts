import type { FastifyPluginAsync } from "fastify";

export const voicesRoutes: FastifyPluginAsync = async (app) => {
	app.post("/", async (request, reply) => {
		try {
			const body = request.body as any;
			const { limit = 20, page = 1, query = {} } = body;
			const formattedQuery: any = {};
			if (query.languages?.length) formattedQuery.languages = query.languages;
			if (query.genders?.length) formattedQuery.genders = query.genders;

			const res = await fetch("https://dubbing-152153811339.us-central1.run.app/search-voices", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ limit, page, query: formattedQuery }),
			});
			if (!res.ok) throw new Error(`External API status: ${res.status}`);
			return reply.send(await res.json());
		} catch (err) {
			app.log.error({ err }, "Error fetching voices");
			return reply.status(500).send({ error: "Failed to fetch voices" });
		}
	});
};
