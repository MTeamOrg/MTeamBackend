import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const appEnvironment = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
const localPath = resolve(process.cwd(), `.env.${appEnvironment}.local`);
const fallbackPath = resolve(process.cwd(), ".env");
const environmentPath = existsSync(localPath) ? localPath : fallbackPath;

if (!existsSync(environmentPath)) {
  throw new Error(`Local environment file does not exist: ${environmentPath}`);
}

let contents = await readFile(environmentPath, "utf8");
const jwtLinePattern = /^\s*JWT_SECRET\s*=.*$/m;
const jwtLine = contents.match(jwtLinePattern)?.[0];
const configuredValue = jwtLine
  ?.replace(/^\s*JWT_SECRET\s*=\s*/, "")
  .trim()
  .replace(/^(["'])(.*)\1$/, "$2");

if (configuredValue) {
  console.log(`JWT_SECRET already configured in ${environmentPath}`);
  process.exit(0);
}

const secret = randomBytes(48).toString("base64url");
if (jwtLine) {
  contents = contents.replace(jwtLinePattern, `JWT_SECRET=${secret}`);
} else {
  const separator = contents.length > 0 && !contents.endsWith("\n") ? "\n" : "";
  contents = `${contents}${separator}JWT_SECRET=${secret}\n`;
}

await writeFile(environmentPath, contents, { encoding: "utf8" });
console.log(`Generated a strong JWT_SECRET in ${environmentPath}`);
