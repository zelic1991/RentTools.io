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
      const unresolvedPath = resolve(dirname(file), match[1]);
      const unresolvedRelativePath = relative(root, unresolvedPath).split(sep).join("/");
      // A fresh deploy checkout has no generated Prisma client yet. It is
      // derived from schema.prisma (already explicit above), so skip the
      // generated import before trying to resolve it on disk.
      if (unresolvedRelativePath.startsWith("src/generated/")) continue;

      const dependency = resolveLocalModule(file, match[1]);
      if (!dependency) {
        throw new Error(`Cannot resolve local schema dependency ${match[1]} from ${file}`);
      }
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
