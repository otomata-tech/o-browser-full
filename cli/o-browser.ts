#!/usr/bin/env node
/**
 * `o-browser` CLI — atomic browser commands + extension dispatcher.
 *
 * Output: JSON by default ({ ok, data, error? }), --text for human-readable.
 *
 * Container management commands (start/stop/restart/status/logs/pull/shell/home)
 * are handled by the bash launcher (bin/o-browser). Browser actions and
 * extension management land here.
 */

import "./lib/silence.js"; // must be first
import { spawn } from "node:child_process";
import { setFormat, err } from "./lib/output.js";
import { sessionCmd } from "./commands/session.js";
import { navCmd } from "./commands/nav.js";
import { readCmd } from "./commands/read.js";
import { interactCmd } from "./commands/interact.js";
import { extensionCmd, findExtensionBin } from "./commands/extension.js";

const USAGE = `o-browser <command> [args]

Container (handled by bin/o-browser bash launcher):
  o-browser start | stop | restart | status | logs | pull | shell | home

Session:
  o-browser session start [--profile <name>] [--workflow <id>]
  o-browser session stop
  o-browser session current
  o-browser vnc

Navigation:
  o-browser nav <url>
  o-browser back | forward | reload

Read:
  o-browser read [selector]              # visible text (default: body)
  o-browser dom [selector]               # outerHTML
  o-browser screenshot [name]            # via session API
  o-browser url
  o-browser title

Interact:
  o-browser click <selector|text>        # use "css:..." or "text:..." to disambiguate
  o-browser type <selector> <text>
  o-browser press <key>                  # Enter, Escape, Tab, ArrowDown, ...
  o-browser wait <selector|--url <re>> [--timeout 30000]

Extensions:
  o-browser extension install <user>/<repo>
  o-browser extension list
  o-browser extension remove <name>
  o-browser extension upgrade <name>

  Once installed: o-browser <name> <args>...
  (e.g. o-browser wise login --identity Alexandre)

Output:
  --json (default) | --text
`;

async function main() {
  const argv = process.argv.slice(2);

  const filtered: string[] = [];
  for (const a of argv) {
    if (a === "--json") setFormat("json");
    else if (a === "--text") setFormat("text");
    else filtered.push(a);
  }

  const cmd = filtered[0];
  const rest = filtered.slice(1);

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  try {
    switch (cmd) {
      case "session":
        await sessionCmd(rest);
        return;
      case "vnc":
        await sessionCmd(["vnc"]);
        return;
      case "nav":
      case "back":
      case "forward":
      case "reload":
        await navCmd(cmd, rest);
        return;
      case "read":
      case "dom":
      case "screenshot":
      case "url":
      case "title":
        await readCmd(cmd, rest);
        return;
      case "click":
      case "type":
      case "press":
      case "wait":
        await interactCmd(cmd, rest);
        return;
      case "extension":
      case "ext":
        await extensionCmd(rest);
        return;
      default: {
        // Try extensions
        const bin = findExtensionBin(cmd);
        if (!bin) {
          err(`unknown command: ${cmd}`, { hint: "run `o-browser help` or `o-browser extension list`" });
        }
        // Exec the extension; pass O_BROWSER_URL so it can talk to the container.
        const child = spawn(bin, rest, {
          stdio: "inherit",
          env: {
            ...process.env,
            O_BROWSER_URL: process.env.O_BROWSER_URL || "http://localhost:8080",
          },
        });
        child.on("exit", (code) => process.exit(code ?? 0));
        return;
      }
    }
  } catch (e: any) {
    err(e?.message || String(e));
  }
}

main();
