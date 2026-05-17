import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const { access, copyFile, readFile, writeFile } = fs.promises;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, "backend", ".env");
const envExamplePath = path.join(repoRoot, "backend", ".env.example");

async function ensureEnvFile() {
	try {
		await access(envPath);
	} catch (error) {
		await copyFile(envExamplePath, envPath);
	}
}

function normalizeUrl(url) {
	const trimmed = url ? url.trim().replace(/\/$/, "") : "";
	if (!trimmed) {
		throw new Error("PUBLIC_APP_URL cannot be empty.");
	}

	if (!/^https?:\/\//.test(trimmed)) {
		throw new Error(`PUBLIC_APP_URL must start with http:// or https:// (${trimmed})`);
	}

	return trimmed;
}

function fetchJson(url) {
	return new Promise((resolve, reject) => {
		const request = http.get(url, (response) => {
			let body = "";

			response.setEncoding("utf8");
			response.on("data", (chunk) => {
				body += chunk;
			});
			response.on("end", () => {
				if (response.statusCode < 200 || response.statusCode >= 300) {
					reject(new Error(`Failed to read ngrok tunnel list: HTTP ${response.statusCode}`));
					return;
				}

				try {
					resolve(JSON.parse(body));
				} catch (error) {
					reject(new Error(`Failed to parse ngrok tunnel list: ${error.message}`));
				}
			});
		});

		request.on("error", reject);
		request.setTimeout(3000, () => {
			request.destroy(new Error("Timed out reading ngrok tunnel list."));
		});
	});
}

export async function updatePublicAppUrl(nextUrl) {
	await ensureEnvFile();

	const normalizedUrl = normalizeUrl(nextUrl);
	const original = await readFile(envPath, "utf8");
	const nextLine = `PUBLIC_APP_URL=${normalizedUrl}`;

	let updated;
	if (/^PUBLIC_APP_URL=.*$/m.test(original)) {
		updated = original.replace(/^PUBLIC_APP_URL=.*$/m, nextLine);
	} else {
		const suffix = original.endsWith("\n") ? "" : "\n";
		updated = `${original}${suffix}${nextLine}\n`;
	}

	if (updated !== original) {
		await writeFile(envPath, updated);
	}

	return normalizedUrl;
}

export async function getNgrokPublicUrl(maxAttempts = 15, delayMs = 1000) {
	let lastError;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const data = await fetchJson("http://127.0.0.1:4040/api/tunnels");
			const tunnels = Array.isArray(data.tunnels) ? data.tunnels : [];
			const tunnel = tunnels.find(
				(item) => item && typeof item.public_url === "string" && item.public_url.startsWith("https://")
			);

			if (!tunnel || !tunnel.public_url) {
				throw new Error("No active HTTPS ngrok tunnel found yet.");
			}

			return normalizeUrl(tunnel.public_url);
		} catch (error) {
			lastError = error;
			if (attempt < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
	}

	throw new Error(
		(lastError && lastError.message) || "No active HTTPS ngrok tunnel found. Start ngrok first."
	);
}

export async function syncNgrokPublicUrl(consoleUrl, maxAttempts, delayMs) {
	const publicUrl = await getNgrokPublicUrl(maxAttempts, delayMs);
	const updatedUrl = await updatePublicAppUrl(publicUrl);
	const callbackUrl = `${updatedUrl}/api/auth/google/callback`;

	console.log(`Updated backend/.env with PUBLIC_APP_URL=${updatedUrl}`);
	console.log(`Google OAuth redirect URI: ${callbackUrl}`);

	if (consoleUrl) {
		console.log(`Google Cloud Console: ${consoleUrl}`);
	}

	return updatedUrl;
}

async function main() {
	const mode = process.argv[2];

	if (mode === "set") {
		const updatedUrl = await updatePublicAppUrl(process.argv[3]);
		console.log(`Updated backend/.env with PUBLIC_APP_URL=${updatedUrl}`);
		return;
	}

	if (mode === "ngrok") {
		const consoleUrl = process.argv[3] ? process.argv[3].trim() : "";
		const maxAttempts = Number(process.argv[4] || "15");
		const delayMs = Number(process.argv[5] || "1000");
		await syncNgrokPublicUrl(consoleUrl, maxAttempts, delayMs);
		return;
	}

	console.error("Usage:");
	console.error("  node ./scripts/public-app-url.mjs set <url>");
	console.error("  node ./scripts/public-app-url.mjs ngrok [google_console_url] [max_attempts] [delay_ms]");
	process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
