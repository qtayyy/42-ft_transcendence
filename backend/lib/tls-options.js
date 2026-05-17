import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCertDir = path.join(__dirname, "..", "certs");

const keyPath = path.join(defaultCertDir, "server.key");
const certPath = path.join(defaultCertDir, "server.crt");

export function getTlsOptions() {
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(
      `TLS certificate or key not found (cert: ${certPath}, key: ${keyPath}). ` +
        "Rebuild the backend image (Docker) or create certs under backend/certs/.",
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}
