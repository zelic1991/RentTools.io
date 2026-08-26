import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildRealDataCutoverPlan,
  type AuthorityReservation,
  type CurrentReservation,
} from "../src/lib/real-data-cutover";

interface DryRunInput {
  authorities: AuthorityReservation[];
  current: CurrentReservation[];
  durableDirectExternalKeyStorage: boolean;
}

async function readInput(path: string): Promise<string> {
  if (path !== "-") return readFile(path, "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  if (process.argv.includes("--apply")) {
    throw new Error("Apply is intentionally unavailable before an explicit Owner GO and a durable Direct external-key decision");
  }
  const inputArg = process.argv.indexOf("--input");
  if (inputArg < 0 || !process.argv[inputArg + 1]) {
    throw new Error("Usage: npx tsx scripts/real-data-cutover-dry-run.ts --input <file|->");
  }
  const raw = await readInput(process.argv[inputArg + 1]);
  const input = JSON.parse(raw) as DryRunInput;
  const plan = buildRealDataCutoverPlan(input.authorities, input.current, {
    durableDirectExternalKeyStorage: input.durableDirectExternalKeyStorage,
  });
  const canonical = JSON.stringify(plan);
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "DRY_RUN_ONLY",
        planSha256: createHash("sha256").update(canonical).digest("hex"),
        ...plan,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
