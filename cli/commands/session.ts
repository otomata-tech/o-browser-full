/**
 * Session lifecycle: start, stop, current, vnc.
 */

import { parseArgs, flagStr } from "../lib/args.js";
import { ok, err } from "../lib/output.js";
import { apiCall, bsStartSession, bsEndSession, vncUrl } from "../lib/client.js";

export async function sessionCmd(argv: string[]): Promise<void> {
  const sub = argv[0];
  const rest = argv.slice(1);

  switch (sub) {
    case "start":
      return startSession(rest);
    case "stop":
      return stopSession();
    case "current":
      return currentSession();
    case "vnc":
      ok({ url: vncUrl() });
    default:
      err(`unknown session subcommand: ${sub ?? "(none)"}`, {
        hint: "session start|stop|current|vnc",
      });
  }
}

async function startSession(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const profile = flagStr(flags, "profile") || "main";
  const workflow = flagStr(flags, "workflow") || "cli";

  const { sessionId, data } = await bsStartSession(workflow, profile);
  ok({
    sessionId,
    profile: data.profile || profile,
    status: data.status,
    workflow: data.workflow || workflow,
    cdp: data.cdp,
    vncUrl: vncUrl(),
  });
}

async function stopSession(): Promise<void> {
  await bsEndSession();
  ok();
}

async function currentSession(): Promise<void> {
  try {
    const data = await apiCall("/api/sessions/current");
    ok({
      sessionId: data?.id,
      profile: data?.profile,
      status: data?.status,
      workflow: data?.workflow,
      cdp: data?.cdp,
      currentUrl: data?.currentUrl,
      vncUrl: vncUrl(),
    });
  } catch (e: any) {
    err(e?.message || "no active session");
  }
}
