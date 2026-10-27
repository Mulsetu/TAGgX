// OWASP ZAP baseline scan (passive: spiders the site and reports issues, no attacks).
//   TARGET_URL=http://localhost:3000 npm run test:dast
// Needs Docker. Writes tests/dast/report/zap-report.html.
// Only scan sites you own; for the full active scan use zap-full-scan.py on staging.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const reportDir = path.join(here, "report");
fs.mkdirSync(reportDir, { recursive: true });
fs.copyFileSync(path.join(here, "zap-rules.tsv"), path.join(reportDir, "zap-rules.tsv"));

const baseUrl = process.env.TARGET_URL;
if (!baseUrl) {
  console.error("Set TARGET_URL, e.g. TARGET_URL=http://localhost:3000 npm run test:dast");
  process.exit(1);
}
// Inside the container, "localhost" is the container itself.
const target = baseUrl.replace(/\/\/(localhost|127\.0\.0\.1)/, "//host.docker.internal");

const args = [
  "run", "--rm",
  "--add-host=host.docker.internal:host-gateway",
  "-v", `${reportDir}:/zap/wrk:rw`,
  "zaproxy/zap-stable",
  "zap-baseline.py",
  "-t", target,
  "-c", "zap-rules.tsv",
  "-r", "zap-report.html",
  "-J", "zap-report.json",
  "-m", process.env.ZAP_SPIDER_MINUTES ?? "2",
  "-I", // exit 0 on warnings; FAIL rules still fail the run
];

console.log(`Scanning ${target} ...`);
const result = spawnSync("docker", args, { stdio: "inherit" });
console.log(`Report: ${path.join(reportDir, "zap-report.html")}`);
process.exit(result.status ?? 1);
