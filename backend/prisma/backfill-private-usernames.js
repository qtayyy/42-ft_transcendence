import { PrismaClient } from "../generated/prisma/index.js";
import { generateUniqueUsername } from "../lib/username-generator.js";

const prisma = new PrismaClient();

/** Replace legacy usernames that contain an email address with safe nicknames. */
async function backfillPrivateUsernames() {
  const exposedProfiles = await prisma.profile.findMany({
    where: { username: { contains: "@" } },
    select: { id: true },
  });

  for (const profile of exposedProfiles) {
    const username = await generateUniqueUsername(prisma);
    await prisma.profile.update({
      where: { id: profile.id },
      data: { username },
    });
  }

  if (exposedProfiles.length > 0) {
    console.log(`Replaced ${exposedProfiles.length} email-based username(s).`);
  }
}

backfillPrivateUsernames()
  .catch((error) => {
    console.error("Failed to backfill private usernames:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
