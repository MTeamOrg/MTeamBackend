import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const requiredIdentityKeys = [
  "BOOTSTRAP_ADMIN_FIRST_NAME",
  "BOOTSTRAP_ADMIN_LAST_NAME",
  "BOOTSTRAP_ADMIN_DOCUMENT_NUMBER",
  "BOOTSTRAP_ADMIN_BIRTH_DATE",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PHONE",
];

const missingKeys = requiredIdentityKeys.filter(
  (key) => !process.env[key]?.trim(),
);
if (missingKeys.length > 0) {
  console.error(
    `Missing local bootstrap variables: ${missingKeys.join(", ")}`,
  );
  process.exit(1);
}

const targetPath = resolve(process.cwd(), ".env.bootstrap.local");
if (existsSync(targetPath)) {
  console.error(
    ".env.bootstrap.local already exists; refusing to overwrite local administrator credentials",
  );
  process.exit(1);
}

const password =
  process.env.BOOTSTRAP_ADMIN_PASSWORD ?? randomBytes(36).toString("base64url");
if (password.length < 12 || password.length > 72) {
  console.error("BOOTSTRAP_ADMIN_PASSWORD must contain between 12 and 72 characters");
  process.exit(1);
}

const lines = [
  ...requiredIdentityKeys.map(
    (key) => `${key}=${JSON.stringify(process.env[key].trim())}`,
  ),
  `BOOTSTRAP_ADMIN_PASSWORD=${JSON.stringify(password)}`,
];

await writeFile(targetPath, `${lines.join("\n")}\n`, {
  encoding: "utf8",
  mode: 0o600,
  flag: "wx",
});

console.log(
  "Created ignored .env.bootstrap.local; the administrator password was stored locally and was not printed",
);
