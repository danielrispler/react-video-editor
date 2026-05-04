import type { FastifyPluginAsync } from "fastify";

const PEXELS_PHOTOS_BASE = "https://api.pexels.com/v1";
const PEXELS_VIDEOS_BASE = "https://api.pexels.com/videos";

export const pexelsRoutes: FastifyPluginAsync = async (app) => {
	app.get<{ Querystring: { query?: string; page?: string; per_page?: string } }>(
		"/pexels",
		async (request, reply) => {
			const { query, page = "1", per_page = "20" } = request.query;
			const apiKey = process.env.PEXELS_API_KEY;
			if (!apiKey) return reply.status(500).send({ error: "Pexels API key not configured" });

			try {
				const url = query
					? `${PEXELS_PHOTOS_BASE}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`
					: `${PEXELS_PHOTOS_BASE}/curated?page=${page}&per_page=${per_page}`;
				const res = await fetch(url, { headers: { Authorization: apiKey } });
				if (!res.ok) throw new Error(`Pexels error: ${res.status}`);
				const data = (await res.json()) as any;
				return {
					photos: data.photos.map((p: any) => ({
						id: `pexels_${p.id}`,
						details: { src: p.src.large2x, width: p.width, height: p.height, photographer: p.photographer, alt: p.alt },
						preview: p.src.medium,
						type: "image",
						metadata: { pexels_id: p.id, avg_color: p.avg_color },
					})),
					total_results: data.total_results ?? 0,
					page: data.page,
					per_page: data.per_page,
					next_page: data.next_page,
					prev_page: data.prev_page,
				};
			} catch (err) {
				app.log.error({ err }, "Pexels API error");
				return reply.status(500).send({ error: "Failed to fetch images from Pexels" });
			}
		},
	);

	app.get<{ Querystring: { query?: string; page?: string; per_page?: string } }>(
		"/pexels-videos",
		async (request, reply) => {
			const { query, page = "1", per_page = "15" } = request.query;
			const apiKey = process.env.PEXELS_API_KEY;
			if (!apiKey) return reply.status(500).send({ error: "Pexels API key not configured" });

			try {
				const url = query
					? `${PEXELS_VIDEOS_BASE}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`
					: `${PEXELS_VIDEOS_BASE}/popular?page=${page}&per_page=${per_page}`;
				const res = await fetch(url, { headers: { Authorization: apiKey } });
				if (!res.ok) throw new Error(`Pexels error: ${res.status}`);
				const data = (await res.json()) as any;
				return {
					videos: data.videos.map((v: any) => {
						const file = v.video_files.find((f: any) => f.quality === "hd" || f.quality === "sd") ?? v.video_files[0];
						return {
							id: `pexels_video_${v.id}`,
							details: { src: file?.link ?? "", width: v.width, height: v.height, duration: v.duration, fps: file?.fps ?? 30 },
							preview: v.video_pictures[0]?.picture ?? v.image,
							type: "video",
							metadata: { pexels_id: v.id, user: v.user },
						};
					}),
					total_results: data.total_results ?? 0,
					page: data.page,
					per_page: data.per_page,
				};
			} catch (err) {
				app.log.error({ err }, "Pexels Video API error");
				return reply.status(500).send({ error: "Failed to fetch videos from Pexels" });
			}
		},
	);
};
