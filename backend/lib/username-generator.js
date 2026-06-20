import crypto from "node:crypto";

/**
 * Generate a neutral username for every new profile. The random component is
 * checked against the unique database index, so no email or real name needs to
 * become a public identifier and collisions are safely retried.
 */
export async function generateUniqueUsername(prisma) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `player-${crypto.randomBytes(6).toString("hex")}`;
    const existing = await prisma.profile.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  throw new Error("Unable to generate a unique username");
}
