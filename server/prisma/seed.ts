import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("[seed] DATABASE_URL is missing");
}

// Prisma 7 + driver adapters: serve adapter anche nel seed
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.env.SEED_MANAGER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_MANAGER_PASSWORD ?? "";

  if (!email || !password) {
    console.log("[seed] SEED_MANAGER_EMAIL / SEED_MANAGER_PASSWORD not set. Skipping.");
    return;
  }

  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    console.log("[seed] Users already exist. Skipping.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      platformRole: "PLATFORM_MANAGER",
    },
  });

  console.log(`[seed] Created PLATFORM_MANAGER: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
