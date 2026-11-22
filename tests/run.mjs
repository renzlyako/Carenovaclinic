// Runs every test file in tests/unit and tests/db. A file fails on a non-zero exit code or any FAIL line.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const only = process.argv[2]; // "unit" | "db" | undefined
const dir = new URL(".", import.meta.url).pathname;
let bad = 0, total = 0;
for (const group of ["unit", "db"]) {
  if (only && only !== group) continue;
  for (const f of readdirSync(dir + group).filter((n) => n.endsWith(".mjs")).sort()) {
    total++;
    const r = spawnSync(process.execPath, ["--import", dir + "register.mjs", dir + group + "/" + f], { encoding: "utf8" });
    const out = (r.stdout || "") + (r.stderr || "");
    const failed = r.status !== 0 || /\bFAIL\b/.test(out);
    const checks = (out.match(/PASS/g) || []).length;
    console.log(`${failed ? "FAIL" : "ok  "}  ${group}/${f}${checks ? `  (${checks} checks)` : ""}`);
    if (failed) { bad++; console.log(out.split("\n").filter((l) => /FAIL|rror/.test(l)).slice(0, 10).join("\n")); }
  }
}
console.log(`\n${total - bad}/${total} test files passed`);
process.exit(bad ? 1 : 0);
