import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const targetPath = resolve(process.cwd(), ".env.smoke.local");
if (existsSync(targetPath)) {
  console.error(
    ".env.smoke.local already exists; refusing to overwrite local smoke credentials",
  );
  process.exit(1);
}

const createPassword = () => randomBytes(24).toString("base64url");
const lines = [
  "SMOKE_API_URL=http://localhost:3000/api",
  `SMOKE_MEMBER_INITIAL_PASSWORD=${createPassword()}`,
  `SMOKE_MEMBER_PASSWORD=${createPassword()}`,
  `SMOKE_TRAINER_PASSWORD=${createPassword()}`,
];

await writeFile(targetPath, `${lines.join("\n")}\n`, {
  encoding: "utf8",
  mode: 0o600,
  flag: "wx",
});

console.log(
  "Created ignored .env.smoke.local with random test passwords; no password was printed",
);
