import type { FastifyPluginAsync } from "fastify";

export const renderRoutes: FastifyPluginAsync = async (app) => {
	app.post("/", async (request, reply) => {
		try {
			const body = request.body;

			const projectResponse = await fetch(
				"https://api.designcombo.dev/v1/projects",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${process.env.COMBO_SK}`,
					},
					body: JSON.stringify(body),
				},
			);

			if (!projectResponse.ok) {
				const projectError = await projectResponse.json();
				return reply
					.status(projectResponse.status)
					.send({ message: (projectError as any)?.message || "Failed to create project" });
			}

			const projectData = (await projectResponse.json()) as any;
			const projectId = projectData.project.id;
			app.log.info({ projectId }, "Project created");

			const exportResponse = await fetch(
				`https://api.designcombo.dev/v1/projects/${projectId}/export`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${process.env.COMBO_SK}`,
					},
				},
			);

			if (!exportResponse.ok) {
				const exportError = await exportResponse.json();
				return reply
					.status(exportResponse.status)
					.send({ message: (exportError as any)?.message || "Failed to initialize export" });
			}

			const exportData = await exportResponse.json();
			app.log.info({ exportData }, "Export initialized");

			return reply.send(exportData);
		} catch (error) {
			app.log.error({ err: error });
			return reply.status(500).send({ message: "Internal server error" });
		}
	});

	app.get<{ Querystring: { type?: string; id?: string } }>(
		"/",
		async (request, reply) => {
			try {
				const { type, id } = request.query;

				if (!id) {
					return reply.status(400).send({ message: "id parameter is required" });
				}
				if (!type) {
					return reply
						.status(400)
						.send({ message: "type parameter is required" });
				}

				const response = await fetch(
					`https://api.combo.sh/v1/render/${id}`,
					{
						headers: {
							Authorization: `Bearer ${process.env.COMBO_SH_JWT}`,
						},
					},
				);

				if (!response.ok) {
					return reply
						.status(response.status)
						.send({ message: "Failed to fetch export status" });
				}

				const statusData = await response.json();
				return reply.send(statusData);
			} catch (error) {
				app.log.error({ err: error });
				return reply.status(500).send({ message: "Internal server error" });
			}
		},
	);
};
