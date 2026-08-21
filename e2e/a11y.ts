import type { Page } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSource: string = require("axe-core").source;

export type A11yViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: string[];
};

/**
 * Run axe-core against a subtree in the page and return only the violations,
 * flattened so failures read clearly in CI output.
 */
export async function analyzeA11y(page: Page, selector: string): Promise<A11yViolation[]> {
  await page.evaluate(axeSource);
  return page.evaluate(async (root) => {
    // @ts-expect-error axe is injected above.
    const results = await window.axe.run(root, {
      resultTypes: ["violations"],
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return results.violations.map(
      (v: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => n.target.join(" ")),
      }),
    );
  }, selector);
}
