import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Deploy contract for the database step of scripts/install-build.sh.
 *
 * Run 32986125110 (2026-08-26) failed with `SQLITE_BUSY: database is locked`:
 * prisma/push-schema.ts ran against the production SQLite file while the
 * rent-tool service was still serving from it. `set -e` aborted the deploy
 * after the artifact swap, so the droplet kept running the old process.
 *
 * These tests execute the real script against a scratch checkout with stubbed
 * git/sudo/systemctl/npx/curl, and assert the ordering that prevents it:
 * stop → migrate → start, with the service restored on every failure path.
 */

const SCRIPT = resolve(process.cwd(), "scripts/install-build.sh");
const FINGERPRINT = resolve(process.cwd(), "scripts/schema-input-fingerprint.mjs");

const sandboxes: string[] = [];

afterEach(() => {
  while (sandboxes.length > 0) {
    const dir = sandboxes.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function writeExecutable(path: string, body: string): void {
  writeFileSync(path, body, "utf8");
  chmodSync(path, 0o755);
}

interface Sandbox {
  root: string;
  repo: string;
  bin: string;
  artifact: string;
  events: string;
  state: string;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "install-build-"));
  sandboxes.push(root);

  const repo = join(root, "repo");
  const bin = join(root, "bin");
  const events = join(root, "events.log");
  const state = join(root, "service.state");
  const stage = join(root, "stage");

  mkdirSync(join(repo, "node_modules", ".bin"), { recursive: true });
  mkdirSync(join(repo, "deploy", "systemd"), { recursive: true });
  mkdirSync(join(repo, "deploy", "nginx"), { recursive: true });
  mkdirSync(join(repo, "deploy", "logrotate"), { recursive: true });
  mkdirSync(join(repo, "prisma"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(stage, ".next"), { recursive: true });
  mkdirSync(join(stage, "src", "generated", "prisma"), { recursive: true });

  writeFileSync(join(repo, "package-lock.json"), '{"lockfileVersion":3}', "utf8");
  writeExecutable(join(repo, "node_modules", ".bin", "next"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(repo, "deploy", "systemd", "rent-tool.service"), "[Service]\n", "utf8");
  writeFileSync(join(repo, "deploy", "nginx", "maintenance.html"), "<html></html>\n", "utf8");
  writeFileSync(join(repo, "deploy", "logrotate", "rent-tool"), "/home/app/logs/*.log {}\n", "utf8");
  writeFileSync(join(repo, ".env.production"), "DATABASE_URL=file:./prod.db\n", "utf8");
  // Minimal but real schema inputs: the fingerprint helper walks
  // prisma/push-schema.ts for relative imports, so keep it import-free.
  writeFileSync(join(repo, "prisma", "schema.prisma"), "// v1\n", "utf8");
  writeFileSync(join(repo, "prisma", "push-schema.ts"), "export {};\n", "utf8");

  writeFileSync(join(stage, ".next", "BUILD_ID"), "test-build\n", "utf8");
  writeFileSync(join(stage, "src", "generated", "prisma", "client.js"), "module.exports={};\n", "utf8");

  const artifact = join(root, "build.tar.gz");
  const bundled = spawnSync("tar", ["-czf", artifact, "-C", stage, ".next", "src/generated/prisma"]);
  if (bundled.status !== 0) throw new Error(`tar failed: ${bundled.stderr?.toString()}`);

  writeFileSync(events, "", "utf8");
  // The droplet is serving when a deploy starts.
  writeFileSync(state, "active\n", "utf8");

  // `sudo` is a no-op wrapper so the stubs below see the real argv.
  writeExecutable(join(bin, "sudo"), '#!/bin/sh\nexec "$@"\n');

  writeExecutable(
    join(bin, "git"),
    `#!/bin/sh
case "$1 $2" in
  "diff --quiet"|"diff --cached") exit 0 ;;
esac
case "$1" in
  diff) exit 0 ;;
  fetch) exit 0 ;;
  reset)
    # A deploy that ships a schema change rewrites prisma/ during the reset.
    if [ "\${SCHEMA_CHANGED:-0}" = "1" ]; then
      printf '// v2 adds a column\\n' > "${repo}/prisma/schema.prisma"
    fi
    exit 0 ;;
  rev-parse) echo "cdab69a" ; exit 0 ;;
esac
exit 0
`,
  );

  writeExecutable(
    join(bin, "systemctl"),
    `#!/bin/sh
STATE="${state}"
EVENTS="${events}"
case "$1" in
  is-active)
    [ "$(cat "$STATE")" = "active" ] && exit 0
    exit 3 ;;
  stop)
    echo "systemctl stop $2" >> "$EVENTS"
    # STUBBORN simulates a unit that will not go down (e.g. a hung worker).
    [ "\${STUBBORN:-0}" = "1" ] || echo inactive > "$STATE"
    exit 0 ;;
  start|restart)
    echo "systemctl $1 $2" >> "$EVENTS"
    echo active > "$STATE"
    exit 0 ;;
  daemon-reload|reload) exit 0 ;;
esac
exit 0
`,
  );

  writeExecutable(
    join(bin, "npx"),
    `#!/bin/sh
EVENTS="${events}"
echo "npx $*" >> "$EVENTS"
case "$*" in
  *push-schema.ts*) exit "\${PUSH_SCHEMA_EXIT:-0}" ;;
esac
exit 0
`,
  );

  writeExecutable(
    join(bin, "curl"),
    `#!/bin/sh
echo "curl health" >> "${events}"
exit 0
`,
  );

  return { root, repo, bin, artifact, events, state };
}

function runInstall(sandbox: Sandbox, env: Record<string, string> = {}) {
  const result = spawnSync("bash", [SCRIPT, sandbox.artifact], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${sandbox.bin}:${process.env.PATH ?? ""}`,
      REPO_DIR: sandbox.repo,
      SERVICE_NAME: "rent-tool",
      HEALTH_URL: "http://127.0.0.1:3000/api/health",
      SCHEMA_FINGERPRINT_SCRIPT: FINGERPRINT,
      GIT_COMMIT_SHA: "cdab69a",
      ...env,
    },
  });
  const events = readFileSync(sandbox.events, "utf8").trim().split("\n").filter(Boolean);
  return { ...result, events, serviceState: readFileSync(sandbox.state, "utf8").trim() };
}

describe("install-build.sh database step", () => {
  it("stops rent-tool before the schema migration and starts it again afterwards", () => {
    const sandbox = makeSandbox();
    const run = runInstall(sandbox, { SCHEMA_CHANGED: "1" });

    expect(run.status, `stderr:\n${run.stderr}`).toBe(0);

    const stop = run.events.indexOf("systemctl stop rent-tool");
    const migrate = run.events.findIndex((line) => line.includes("push-schema.ts"));
    const seed = run.events.findIndex((line) => line.includes("seed-blog-posts.ts"));
    const start = run.events.findIndex((line) => /^systemctl (start|restart) rent-tool$/.test(line));

    expect(stop).toBeGreaterThanOrEqual(0);
    expect(migrate).toBeGreaterThan(stop);
    // The blog seed writes to the same SQLite file, so it belongs in the
    // stopped window too — it used to run against the live database.
    expect(seed).toBeGreaterThan(stop);
    expect(start).toBeGreaterThan(migrate);
    expect(start).toBeGreaterThan(seed);
    expect(run.serviceState).toBe("active");
    expect(run.events).toContain("curl health");
  });

  it("restarts rent-tool and fails the deploy when the schema migration fails", () => {
    const sandbox = makeSandbox();
    const run = runInstall(sandbox, { SCHEMA_CHANGED: "1", PUSH_SCHEMA_EXIT: "1" });

    // A locked database (SQLITE_BUSY) surfaces exactly like this.
    expect(run.status).toBe(15);
    expect(run.stderr).toContain("schema migration failed");

    const stop = run.events.indexOf("systemctl stop rent-tool");
    const migrate = run.events.findIndex((line) => line.includes("push-schema.ts"));
    const start = run.events.findIndex((line) => /^systemctl (start|restart) rent-tool$/.test(line));

    expect(migrate).toBeGreaterThan(stop);
    expect(start).toBeGreaterThan(migrate);
    // Deploy failed, but the site is back up and no health check was claimed.
    expect(run.serviceState).toBe("active");
    expect(run.events.some((line) => line.includes("seed-blog-posts.ts"))).toBe(false);
    expect(run.events).not.toContain("curl health");
  });

  it("refuses to migrate when the service will not stop", { timeout: 60_000 }, () => {
    const sandbox = makeSandbox();
    const run = runInstall(sandbox, { SCHEMA_CHANGED: "1", STUBBORN: "1" });

    expect(run.status).toBe(14);
    expect(run.stderr).toContain("refusing to migrate a live database");
    expect(run.events.some((line) => line.includes("push-schema.ts"))).toBe(false);
    // Still restored, so a stuck unit does not also cost us the deploy's restart.
    expect(run.events.some((line) => /^systemctl (start|restart) rent-tool$/.test(line))).toBe(true);
  });

  it("stops the service for the blog seed even when the schema is unchanged", () => {
    const sandbox = makeSandbox();
    const run = runInstall(sandbox, { SCHEMA_CHANGED: "0" });

    expect(run.status, `stderr:\n${run.stderr}`).toBe(0);
    expect(run.stdout).toContain("schema migration inputs unchanged");
    expect(run.events.some((line) => line.includes("push-schema.ts"))).toBe(false);

    const stop = run.events.indexOf("systemctl stop rent-tool");
    const seed = run.events.findIndex((line) => line.includes("seed-blog-posts.ts"));
    expect(seed).toBeGreaterThan(stop);
    expect(run.serviceState).toBe("active");
  });
});
