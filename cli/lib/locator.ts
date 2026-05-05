/**
 * Resolve a target string into a Playwright Locator.
 *
 * Strategy:
 *   - Explicit prefix wins: "css:..." or "text:..."
 *   - Otherwise: try CSS first (fast structural match), fall back to text content.
 *   - Always returns a Locator and a list of matches; caller decides what to do
 *     when matches > 1 (typically: report ambiguity).
 */

import type { Locator, Page } from "playwright-core";

export type Resolved = {
  kind: "css" | "text";
  query: string;
  locator: Locator;
  count: number;
};

export async function resolveTarget(page: Page, target: string): Promise<Resolved> {
  if (target.startsWith("css:")) {
    const q = target.slice(4);
    const loc = page.locator(q);
    return { kind: "css", query: q, locator: loc, count: await loc.count() };
  }
  if (target.startsWith("text:")) {
    const q = target.slice(5);
    const loc = page.getByText(q, { exact: false });
    return { kind: "text", query: q, locator: loc, count: await loc.count() };
  }

  try {
    const loc = page.locator(target);
    const count = await loc.count();
    if (count > 0) return { kind: "css", query: target, locator: loc, count };
  } catch {
    // Invalid CSS selector — fall through to text.
  }

  const loc = page.getByText(target, { exact: false });
  return { kind: "text", query: target, locator: loc, count: await loc.count() };
}

export async function describeMatches(loc: Locator, max = 5): Promise<Array<{ tag: string; text: string }>> {
  const total = await loc.count();
  const n = Math.min(total, max);
  const out: Array<{ tag: string; text: string }> = [];
  for (let i = 0; i < n; i++) {
    const item = loc.nth(i);
    try {
      const info = await item.evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 80),
      }));
      out.push(info);
    } catch {
      out.push({ tag: "?", text: "(unreadable)" });
    }
  }
  return out;
}
