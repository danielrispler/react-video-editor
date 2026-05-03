import type { FastifyPluginAsync } from "fastify";

const PEXELS_PHOTOS_BASE = "https://api.pexels.com/v1";
const PEXELS_VIDEOS_BASE = "https://api.pexels.com/videos";

export const pexelsRoutes: FastifyPluginAsync = async (app) => {
	app.get<{ Querystring: { query?: string; page?: string; per_page?: string } }>(
		"/pexels",
		async (request, reply) => {
			const { query, page = "1", per_page = "20" } = request.query;
			const apiKey = process.env.PEXELS_API_KEY;

			if (!apiKey) {
				return reply
					.status(500)
					.send({ error: "Pexels API key not configured" });
			}

			try {
				const url = query
					? `${PEXELS_PHOTOS_BASE}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`
					: `${PEXELS_PHOTOS_BASE}/curated?page=${page}&per_page=${per_page}`;

				const response = await fetch(url, {
					headers: { Authorization: apiKey },
				});

				if (!response.ok) {
					throw new Error(`Pexels API error: ${response.status}`);
				}

				const data = (await response.json()) as any;

				const transformedPhotos = data.photos.map((photo: any) => ({
					id: `pexels_${photo.id}`,
					details: {
						src: photo.src.large2x,
						width: photo.width,
						height: photo.height,
						photographer: photo.photographer,
						photographer_url: photo.photographer_url,
						alt: photo.alt,
					},
					preview: photo.src.medium,
					type: "image" as const,
					metadata: {
						pexels_id: photo.id,
						avg_color: photo.avg_color,
						original_url: photo.src.original,
					},
				}));

				return {
					photos: transformedPhotos,
					total_results: data.total_results ?? 0,
					page: data.page,
					per_page: data.per_page,
					next_page: data.next_page,
					prev_page: data.prev_page,
				};
			} catch (error) {
				app.log.error({ err: error }, "Pexels API error:");
				return reply
					.status(500)
					.send({ error: "Failed to fetch images from Pexels" });
			}
		},
	);

	app.get<{ Querystring: { query?: string; page?: string; per_page?: string } }>(
		"/pexels-videos",
		async (request, reply) => {
			const { query, page = "1", per_page = "15" } = request.query;
			const apiKey = process.env.PEXELS_API_KEY;

			if (!apiKey) {
				return reply
					.status(500)
					.send({ error: "Pexels API key not configured" });
			}

			try {
				const url = query
					? `${PEXELS_VIDEOS_BASE}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`
					: `${PEXELS_VIDEOS_BASE}/popular?page=${page}&per_page=${per_page}`;

				const response = await fetch(url, {
					headers: { Authorization: apiKey },
				});

				if (!response.ok) {
					throw new Error(`Pexels API error: ${response.status}`);
				}

				const data = (await response.json()) as any;

				const transformedVideos = data.videos.map((video: any) => {
					const videoFile =
						video.video_files.find(
							(f: any) => f.quality === "hd" || f.quality === "sd",
						) || video.video_files[0];

					const previewPicture =
						video.video_pictures[0]?.picture || video.image;

					return {
						id: `pexels_video_${video.id}`,
						details: {
							src: videoFile?.link || "",
							width: video.width,
							height: video.height,
							duration: video.duration,
							fps: videoFile?.fps || 30,
						},
						preview: previewPicture,
						type: "video" as const,
						metadata: {
							pexels_id: video.id,
							user: video.user,
							video_files: video.video_files,
							video_pictures: video.video_pictures,
						},
					};
				});

				return {
					videos: transformedVideos,
					total_results: data.total_results ?? 0,
					page: data.page,
					per_page: data.per_page,
					next_page: data.next_page,
					prev_page: data.prev_page,
				};
			} catch (error) {
				app.log.error({ err: error }, "Pexels Video API error:");
				return reply
					.status(500)
					.send({ error: "Failed to fetch videos from Pexels" });
			}
		},
	);
};
