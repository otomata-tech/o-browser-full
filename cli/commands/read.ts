/**
 * Read commands: read (text), dom (HTML), screenshot, url, title.
 */

import { parseArgs } from "../lib/args.js";
import { ok, err } from "../lib/output.js";
import { withPage, bsScreenshot, apiCall } from "../lib/client.js";

export async function readCmd(cmd: string, argv: string[]): Promise<void> {
  const { positional } = parseArgs(argv);

  switch (cmd) {
    case "read":
      return readText(positional[0] || "body");
    case "dom":
      return readDom(positional[0] || "body");
    case "screenshot":
      return takeScreenshot(positional[0] || `cli_${Date.now()}`);
    case "url":
      return getUrl();
    case "title":
      return getTitle();
    default:
      err(`unknown read command: ${cmd}`);
  }
}

async function readText(selector: string): Promise<void> {
  await withPage(async (page) => {
    const loc = page.locator(selector);
    const count = await loc.count();
    if (count === 0) err(`no element matches: ${selector}`);
    const text = await loc.first().innerText().catch(() => "");
    ok({ selector, count, text });
  });
}

async function readDom(selector: string): Promise<void> {
  await withPage(async (page) => {
    const loc = page.locator(selector);
    const count = await loc.count();
    if (count === 0) err(`no element matches: ${selector}`);
    const html = await loc.first().evaluate((el) => (el as Element).outerHTML);
    ok({ selector, count, html });
  });
}

async function takeScreenshot(name: string): Promise<void> {
  await bsScreenshot(name);
  try {
    const session = await apiCall("/api/sessions/current");
    ok({ name, sessionId: session?.id, recordingsPath: `recordings/${session?.id}/screenshots/${name}.png` });
  } catch {
    ok({ name });
  }
}

async function getUrl(): Promise<void> {
  await withPage(async (page) => ok({ url: page.url() }));
}

async function getTitle(): Promise<void> {
  await withPage(async (page) => ok({ title: await page.title() }));
}
