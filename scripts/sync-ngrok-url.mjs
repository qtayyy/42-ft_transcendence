import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, "backend", ".env");

async function getNgrokPublicUrl() {
  const response = await fetch("http://127.0.0.1:4040/api/tunnels");
  if (!response.ok) {
    throw new Error(`Failed to read ngrok tunnel list: HTTP ${response.status}`);
  }

  const data = await response.json();
  const tunnel = data.tunnels?.find((item) =>
    typeof item.public_url === "string" && item.public_url.startsWith("https://")
  );

  if (!tunnel?.public_url) {
    throw new Error("No active HTTPS ngrok tunnel found. Start ngrok first.");
  }

  return tunnel.public_url.replace(/\/$/, "");
}

async function updatePublicAppUrl(nextUrl) {
  const original = await readFile(envPath, "utf8");
  const nextLine = `PUBLIC_APP_URL=${nextUrl}`;

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
}

async function main() {
  const consoleUrl = process.argv[2]?.trim();
  const publicUrl = await getNgrokPublicUrl();
  const callbackUrl = `${publicUrl}/api/auth/google/callback`;

  await updatePublicAppUrl(publicUrl);

  console.log(`Updated backend/.env with PUBLIC_APP_URL=${publicUrl}`);
  console.log(`Google OAuth redirect URI: ${callbackUrl}`);

  if (consoleUrl) {
    console.log(`Google Cloud Console: ${consoleUrl}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
