/**
 * Navigation commands: nav, back, forward, reload.
 */

import { ok, err } from "../lib/output.js";
import { withPage } from "../lib/client.js";

export async function navCmd(cmd: string, argv: string[]): Promise<void> {
  await withPage(async (page) => {
    switch (cmd) {
      case "nav": {
        const url = argv[0];
        if (!url) err("usage: o-browser nav <url>");
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        break;
      }
      case "back":
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 60_000 });
        break;
      case "forward":
        await page.goForward({ waitUntil: "domcontentloaded", timeout: 60_000 });
        break;
      case "reload":
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
        break;
      default:
        err(`unknown nav command: ${cmd}`);
    }
    ok({ url: page.url(), title: await page.title() });
  });
}
