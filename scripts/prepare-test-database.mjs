import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const testDatabaseUrl =
  "postgresql://health_user:health_password@localhost:5432/health_assessment_test?schema=public";
const prismaPath = join(process.cwd(), "node_modules", "prisma", "build", "index.js");

if (!existsSync(prismaPath)) {
  throw new Error("Prisma CLI is not installed. Run npm install before preparing the test database.");
}

execFileSync(process.execPath, [prismaPath, "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: "inherit",
});
