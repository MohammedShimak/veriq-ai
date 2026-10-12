import { spawnSync } from "child_process";

const steps = ["data/normalize.js", "data/rechunk.js", "data/embedAndStoreFAISS.js"];

for (const step of steps) {
  const result = spawnSync(process.execPath, [step], { stdio: "inherit" });
  if (result.error) {
    console.error(`Failed to start ${step}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
