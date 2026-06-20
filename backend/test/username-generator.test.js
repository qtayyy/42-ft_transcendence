import assert from "node:assert/strict";
import test from "node:test";

import { generateUniqueUsername } from "../lib/username-generator.js";

test("generated usernames are neutral and contain no email material", async () => {
  const prisma = {
    profile: {
      async findUnique() {
        return null;
      },
    },
  };

  const username = await generateUniqueUsername(prisma);

  assert.match(username, /^player-[a-f0-9]{12}$/);
  assert.equal(username.includes("@"), false);
});

test("generated usernames retry when a candidate already exists", async () => {
  let checks = 0;
  const prisma = {
    profile: {
      async findUnique() {
        checks += 1;
        return checks === 1 ? { id: 1 } : null;
      },
    },
  };

  const username = await generateUniqueUsername(prisma);

  assert.equal(checks, 2);
  assert.match(username, /^player-[a-f0-9]{12}$/);
});
