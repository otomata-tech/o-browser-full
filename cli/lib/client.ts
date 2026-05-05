/**
 * Browser-service HTTP API + Playwright CDP helpers.
 *
 * Talks to the local o-browser-full container (HTTP on O_BROWSER_URL) and exposes
 * a Playwright Page over CDP for actions that need direct DOM manipulation.
 */

import type { Page } from "playwright-core";
import { getPage as cdpGetPage, disconnectBrowser } from "./cdp.js";

const DEFAULT_PROFILE = "main";

export { disconnectBrowser };

function getConfig() {
  const url = process.env.O_BROWSER_URL || process.env.BROWSER_URL || "http://localhost:8080";
  return { url };
}

/** Raw browser-service API call. Returns parsed JSON or throws. */
export async function apiCall(path: string, init: RequestInit = {}): Promise<any> {
  const { url } = getConfig();
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const msg = typeof body === "object" && body?.error ? body.error : text || `HTTP ${res.status}`;
    throw new Error(`${path}: ${msg}`);
  }
  return body;
}

export async function checkExistingSession(): Promise<any | null> {
  try {
    const data = await apiCall("/api/sessions/current");
    if (data?.status === "active" || data?.status === "starting") return data;
  } catch {}
  return null;
}

export async function bsStartSession(
  workflow: string,
  profile?: string,
): Promise<{ sessionId: string; data: any }> {
  const profileName = profile || DEFAULT_PROFILE;

  const existing = await checkExistingSession();
  if (existing) {
    if ((existing.profile || DEFAULT_PROFILE) === profileName) {
      console.log(`[browser] Reusing session: ${existing.id} (profile: ${existing.profile})`);
      return { sessionId: existing.id, data: existing };
    }
    console.log(`[browser] Ending session with different profile (${existing.profile})`);
    await apiCall("/api/sessions/current", { method: "DELETE" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`[browser] Creating session: workflow=${workflow}, profile=${profileName}`);
  const data = await apiCall("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ workflow, profile: profileName }),
  });
  console.log(`[browser] Session created: ${data.id}`);
  return { sessionId: data.id, data };
}

export async function bsEndSession(): Promise<void> {
  try {
    await apiCall("/api/sessions/current", { method: "DELETE" });
    console.log("[browser] Session ended");
  } catch (e) {
    console.error("[browser] Failed to end session:", e);
  }
}

export async function bsScreenshot(name: string): Promise<void> {
  try {
    await apiCall("/api/sessions/current/screenshot", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  } catch (e: any) {
    console.error(`[browser] Screenshot failed: ${e.message}`);
  }
}

export function vncUrl(): string {
  const { url } = getConfig();
  return `${url}/vnc/vnc.html?autoconnect=true&resize=scale`;
}

export async function getPage(): Promise<Page> {
  const { page } = await cdpGetPage();
  return page;
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  try {
    const page = await getPage();
    return await fn(page);
  } finally {
    await disconnectBrowser();
  }
}
