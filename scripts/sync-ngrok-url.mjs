import { syncNgrokPublicUrl } from "./public-app-url.mjs";

syncNgrokPublicUrl(process.argv[2]?.trim()).catch((error) => {
	console.error(error.message);
	process.exit(1);
});
