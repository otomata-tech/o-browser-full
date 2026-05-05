/**
 * Shared CDP browser connection — lazy, reused across tool calls within a run.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

let _browser: Browser | null = null;
let _page: Page | null = null;
let _context: BrowserContext | null = null;

function browserUrl(): string {
  return process.env.O_BROWSER_URL || process.env.BROWSER_URL || "http://localhost:8080";
}

async function getCdpUrl(): Promise<string> {
  const baseUrl = browserUrl();
  const res = await fetch(`${baseUrl}/api/sessions/current`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`No browser session: ${res.status}`);
  const data = await res.json();
  const wsUrl = data.cdp?.ws_url;
  if (!wsUrl) throw new Error("No CDP URL in session");
  return wsUrl;
}

export async function getPage(): Promise<{ page: Page; context: BrowserContext }> {
  if (_page && _context) {
    try {
      await _page.evaluate("1");
      return { page: _page, context: _context };
    } catch {
      console.log("[cdp] Stale connection detected, reconnecting...");
      _browser = null;
      _page = null;
      _context = null;
    }
  }

  const cdpUrl = await getCdpUrl();
  console.log(`[cdp] Connecting: ${cdpUrl}`);
  _browser = await chromium.connectOverCDP(cdpUrl);

  const contexts = _browser.contexts();
  _context = contexts.length > 0 ? contexts[0] : await _browser.newContext({ acceptDownloads: true });

  const pages = _context.pages();
  _page = pages.find((p) => !p.url().startsWith("chrome://")) || pages[0] || (await _context.newPage());
  console.log(
    `[cdp] Using page: ${_page.url()} (${pages.length} pages in context, filtered ${pages.filter((p) => p.url().startsWith("chrome://")).length} internal)`,
  );

  return { page: _page, context: _context };
}

export async function disconnectBrowser(): Promise<void> {
  if (_browser) {
    try {
      await _browser.close();
    } catch {}
    _browser = null;
    _page = null;
    _context = null;
  }
}
