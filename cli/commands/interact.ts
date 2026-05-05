/**
 * Interaction commands: click, type, press, wait.
 */

import { parseArgs, flagInt, flagStr } from "../lib/args.js";
import { ok, err } from "../lib/output.js";
import { withPage } from "../lib/client.js";
import { resolveTarget, describeMatches } from "../lib/locator.js";

export async function interactCmd(cmd: string, argv: string[]): Promise<void> {
  switch (cmd) {
    case "click":
      return clickCmd(argv);
    case "type":
      return typeCmd(argv);
    case "press":
      return pressCmd(argv);
    case "wait":
      return waitCmd(argv);
    default:
      err(`unknown interact command: ${cmd}`);
  }
}

async function clickCmd(argv: string[]): Promise<void> {
  const { positional, flags } = parseArgs(argv);
  const target = positional[0];
  if (!target) err("usage: o-browser click <selector|text>");
  const timeout = flagInt(flags, "timeout", 10_000);

  await withPage(async (page) => {
    const r = await resolveTarget(page, target);
    if (r.count === 0) err(`no element matches: ${target}`);
    if (r.count > 1) {
      const matches = await describeMatches(r.locator);
      err("ambiguous", {
        target,
        kind: r.kind,
        count: r.count,
        matches,
        hint: 'use "css:..." or a more specific selector',
      });
    }
    await r.locator.first().click({ timeout });
    ok({ target, kind: r.kind });
  });
}

async function typeCmd(argv: string[]): Promise<void> {
  const { positional, flags } = parseArgs(argv);
  const selector = positional[0];
  const text = positional[1];
  if (!selector || text === undefined) err("usage: o-browser type <selector> <text>");
  const timeout = flagInt(flags, "timeout", 10_000);

  await withPage(async (page) => {
    const loc = page.locator(selector);
    const count = await loc.count();
    if (count === 0) err(`no element matches: ${selector}`);
    if (count > 1) err("ambiguous", { selector, count, hint: "use a more specific selector" });
    await loc.first().fill(text, { timeout });
    ok({ selector, text });
  });
}

async function pressCmd(argv: string[]): Promise<void> {
  const { positional } = parseArgs(argv);
  const key = positional[0];
  if (!key) err("usage: o-browser press <key>");

  await withPage(async (page) => {
    await page.keyboard.press(key);
    ok({ key });
  });
}

async function waitCmd(argv: string[]): Promise<void> {
  const { positional, flags } = parseArgs(argv);
  const timeout = flagInt(flags, "timeout", 30_000);
  const urlPattern = flagStr(flags, "url");
  const target = positional[0];

  if (!urlPattern && !target) err("usage: o-browser wait <selector> | o-browser wait --url <regex>");

  await withPage(async (page) => {
    if (urlPattern) {
      const re = new RegExp(urlPattern);
      await page.waitForURL(re, { timeout });
      ok({ matched: page.url() });
    } else {
      const r = await resolveTarget(page, target!);
      await r.locator.first().waitFor({ state: "visible", timeout });
      ok({ target, kind: r.kind });
    }
  });
}
