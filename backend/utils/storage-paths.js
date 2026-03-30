import path from "path";

export function getUploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

