export const baseUrl = import.meta.env.DEV
	? new URL("http://localhost:3000")
	: new URL("https://designcombo.dev");
