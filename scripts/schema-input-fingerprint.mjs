import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_MODULE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];
const IMPORT_PATTERN = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["'](\.[^"']+)["']/g;

function resolveLocalModule(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  return LOCAL_MODULE_EXTENSIONS.map((extension) => `${base}${extension}`).find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
}

export function collectSchemaInputPaths(repoRoot) {
  const root = resolve(repoRoot);
  const schema = resolve(root, "prisma/schema.prisma");
  const entrypoint = resolve(root, "prisma/push-schema.ts");
  const pending = [entrypoint];
  const collected = new Set([schema]);

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || collected.has(file)) continue;
    if (!existsSync(file)) throw new Error(`Schema input is missing: ${file}`);
    collected.add(file);

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const dependency = resolveLocalModule(file, match[1]);
      if (!dependency) {
        throw new Error(`Cannot resolve local schema dependency ${match[1]} from ${file}`);
      }
      const relativePath = relative(root, dependency).split(sep).join("/");
      // Generated Prisma code is derived from schema.prisma, which is already
      // an explicit input. Hand-maintained local migration code remains traced.
      if (relativePath.startsWith("src/generated/")) continue;
      pending.push(dependency);
    }
  }

  return [...collected].sort();
}

export function fingerprintSchemaInputs(repoRoot) {
  const root = resolve(repoRoot);
  const hash = createHash("sha256");
  for (const file of collectSchemaInputPaths(root)) {
    hash.update(relative(root, file).split(sep).join("/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${fingerprintSchemaInputs(process.argv[2] ?? process.cwd())}\n`);
}
