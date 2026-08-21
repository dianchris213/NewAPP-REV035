#!/usr/bin/env node
/**
 * Builds the BillingCalendar / BillingSheet visual-regression PR comment.
 *
 * Reads the Playwright JSON report (playwright-report/results.json) plus the
 * `*-diff.png` / `*-actual.png` files under test-results/, then writes a
 * markdown summary to `visual-report.md` (and to $GITHUB_STEP_SUMMARY when set).
 *
 * The summary states, per snapshot, whether the diff is within the documented
 * thresholds (threshold 0.1, maxDiffPixelRatio 0.005 — see playwright.config.ts).
 *
 * Usage: node scripts/visual-diff-report.mjs [outFile]
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const THRESHOLD = 0.1;
const MAX_DIFF_PIXEL_RATIO = 0.005;
const RESULTS = "playwright-report/results.json";
const RESULTS_DIR = "test-results";
const OUT = process.argv[2] ?? "visual-report.md";

/** Recursively list files under `dir`. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Flatten the Playwright JSON suite tree into {title, status, errors} rows. */
function flatten(suite, trail = []) {
  const path = [...trail, suite.title].filter(Boolean);
  const rows = (suite.specs ?? []).map((spec) => {
    const result = spec.tests?.[0]?.results?.at(-1);
    return {
      title: [...path, spec.title].join(" › "),
      status: spec.ok ? "passed" : (result?.status ?? "failed"),
      error: result?.error?.message ?? "",
      attachments: result?.attachments ?? [],
    };
  });
  return rows.concat((suite.suites ?? []).flatMap((child) => flatten(child, path)));
}

const isBilling = (title) => /billing(calendar|sheet)?/i.test(title);

let rows = [];
if (existsSync(RESULTS)) {
  const report = JSON.parse(readFileSync(RESULTS, "utf8"));
  rows = (report.suites ?? []).flatMap((suite) => flatten(suite)).filter((r) => isBilling(r.title));
}

const diffFiles = walk(RESULTS_DIR).filter((f) => /-(diff|actual)\.png$/.test(f) && isBilling(f));
const diffs = diffFiles.filter((f) => f.endsWith("-diff.png"));

/** Pull the "ratio X of all image pixels" figure Playwright reports on failure. */
function ratioOf(error) {
  const m = /ratio\s+([0-9.]+)/.exec(error) ?? /(\d+)\s+pixels.*ratio\s+([0-9.]+)/.exec(error);
  return m ? Number(m[1]) : null;
}

const failed = rows.filter((r) => r.status !== "passed" && r.status !== "skipped");
const withinThreshold = failed.length === 0;

const lines = [];
lines.push("## Visual regression — BillingCalendar / BillingSheet", "");
lines.push(
  `**Thresholds (documented, do not loosen):** \`threshold: ${THRESHOLD}\`, ` +
    `\`maxDiffPixelRatio: ${MAX_DIFF_PIXEL_RATIO}\``,
  "",
);

if (rows.length === 0) {
  lines.push("_No BillingCalendar/BillingSheet snapshot results found in this run._");
} else {
  lines.push(
    withinThreshold
      ? `✅ **All ${rows.length} billing snapshot checks are within the documented thresholds.**`
      : `❌ **${failed.length} of ${rows.length} billing snapshot checks exceed the documented thresholds.**`,
    "",
    "| Snapshot | Result | Diff ratio | Verdict |",
    "| --- | --- | --- | --- |",
  );
  for (const row of rows) {
    const ratio = ratioOf(row.error);
    const verdict =
      row.status === "passed"
        ? "within threshold"
        : ratio !== null
          ? `over budget (> ${MAX_DIFF_PIXEL_RATIO})`
          : "failed";
    lines.push(
      `| ${row.title} | ${row.status === "passed" ? "✅ pass" : "❌ fail"} | ${
        ratio !== null ? ratio : "—"
      } | ${verdict} |`,
    );
  }
}

if (diffs.length) {
  lines.push("", "### Diff images attached to this run", "");
  for (const file of diffFiles) lines.push(`- \`${relative(".", file)}\``);
  lines.push(
    "",
    "Download the **billing-visual-artifacts** workflow artifact to open the",
    "`*-diff.png` (red = changed pixels) and `*-actual.png` files, plus the",
    "Playwright trace (`trace.zip`) for the failing test.",
  );
}

lines.push(
  "",
  "<details><summary>Approving an intentional UI change</summary>",
  "",
  "1. Review every `*-diff.png` above and confirm the change is intended.",
  "2. Run `bun run e2e:update:billing` locally.",
  "3. Commit the regenerated PNGs under `e2e/__screenshots__/` in the **same PR** and list them in the description.",
  "",
  "Never raise `threshold` / `maxDiffPixelRatio` to make a red baseline pass.",
  "</details>",
  "",
);

const markdown = lines.join("\n");
writeFileSync(OUT, markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
process.exit(0);
