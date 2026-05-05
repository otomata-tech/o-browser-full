/**
 * Extension lifecycle: install, list, remove, upgrade.
 *
 * An extension is a git repo cloned to ~/.o-browser-full/extensions/<name>/
 * containing an executable `o-browser-<name>` at the root. The dispatcher in
 * cli/o-browser.ts looks up unknown subcommands here.
 *
 * Naming convention (inspired by `gh extension`):
 *   - Repos named "<user>/o-browser-<name>" → extension <name> (auto)
 *   - Other repos must include a `.o-browser-extension.json` at the root with
 *     {"name": "<extension-name>"}
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ok, err } from "../lib/output.js";

const EXT_HOME = process.env.O_BROWSER_HOME
  ? join(process.env.O_BROWSER_HOME, "extensions")
  : join(homedir(), ".o-browser-full", "extensions");

export async function extensionCmd(argv: string[]): Promise<void> {
  const sub = argv[0];
  const rest = argv.slice(1);

  switch (sub) {
    case "install":
      return install(rest);
    case "list":
    case "ls":
      return list();
    case "remove":
    case "rm":
      return remove(rest);
    case "upgrade":
    case "update":
      return upgrade(rest);
    default:
      err(`unknown extension subcommand: ${sub ?? "(none)"}`, {
        hint: "extension install|list|remove|upgrade",
      });
  }
}

function ensureHome() {
  if (!existsSync(EXT_HOME)) {
    execFileSync("mkdir", ["-p", EXT_HOME]);
  }
}

function deriveExtensionName(repoSlug: string, clonedPath: string): string {
  const manifestPath = join(clonedPath, ".o-browser-extension.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifest.name && /^[a-z][a-z0-9-]*$/.test(manifest.name)) {
        return manifest.name;
      }
    } catch {}
  }
  const repoName = repoSlug.split("/").pop() || repoSlug;
  if (repoName.startsWith("o-browser-")) {
    return repoName.slice("o-browser-".length);
  }
  return repoName;
}

async function install(args: string[]): Promise<void> {
  const repoSlug = args[0];
  if (!repoSlug || !repoSlug.includes("/")) {
    err("usage: o-browser extension install <user>/<repo>");
  }

  ensureHome();
  const url = repoSlug.startsWith("http") ? repoSlug : `https://github.com/${repoSlug}.git`;
  const tmpName = `_install_${Date.now()}`;
  const tmpPath = join(EXT_HOME, tmpName);

  try {
    execFileSync("git", ["clone", "--depth=1", url, tmpPath], { stdio: "pipe" });
  } catch (e: any) {
    err(`git clone failed: ${e.message || e}`);
  }

  const name = deriveExtensionName(repoSlug, tmpPath);
  const finalPath = join(EXT_HOME, name);
  const binPath = join(tmpPath, `o-browser-${name}`);

  if (!existsSync(binPath)) {
    rmSync(tmpPath, { recursive: true, force: true });
    err(
      `extension is missing executable o-browser-${name} at the root of the repo`,
      { repo: repoSlug, expectedBin: `o-browser-${name}` },
    );
  }

  try {
    execFileSync("chmod", ["+x", binPath]);
  } catch {}

  if (existsSync(finalPath)) {
    rmSync(finalPath, { recursive: true, force: true });
  }
  execFileSync("mv", [tmpPath, finalPath]);

  // Run `npm install` if a package.json exists at the root
  const pkgJson = join(finalPath, "package.json");
  if (existsSync(pkgJson)) {
    try {
      execFileSync("npm", ["install", "--silent"], { cwd: finalPath, stdio: "pipe" });
    } catch (e: any) {
      console.error(`[ext] npm install failed: ${e.message || e}`);
    }
  }

  // Run a setup script if present
  const setupScript = join(finalPath, ".o-browser-extension-setup.sh");
  if (existsSync(setupScript)) {
    try {
      execFileSync("bash", [setupScript], { cwd: finalPath, stdio: "inherit" });
    } catch (e: any) {
      console.error(`[ext] setup script failed: ${e.message || e}`);
    }
  }

  ok({ name, path: finalPath, repo: repoSlug });
}

function list(): void {
  if (!existsSync(EXT_HOME)) {
    ok({ extensions: [] });
  }
  const entries = readdirSync(EXT_HOME, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_install_"))
    .map((e) => {
      const dir = join(EXT_HOME, e.name);
      const bin = join(dir, `o-browser-${e.name}`);
      return {
        name: e.name,
        path: dir,
        ok: existsSync(bin),
      };
    });
  ok({ extensions: entries });
}

function remove(args: string[]): void {
  const name = args[0];
  if (!name) err("usage: o-browser extension remove <name>");
  const path = join(EXT_HOME, name);
  if (!existsSync(path)) err(`extension not installed: ${name}`);
  rmSync(path, { recursive: true, force: true });
  ok({ name, removed: true });
}

function upgrade(args: string[]): void {
  const name = args[0];
  if (!name) err("usage: o-browser extension upgrade <name>");
  const path = join(EXT_HOME, name);
  if (!existsSync(path)) err(`extension not installed: ${name}`);
  try {
    execFileSync("git", ["-C", path, "pull", "--ff-only"], { stdio: "pipe" });
  } catch (e: any) {
    err(`git pull failed: ${e.message || e}`);
  }
  const pkgJson = join(path, "package.json");
  if (existsSync(pkgJson)) {
    try {
      execFileSync("npm", ["install", "--silent"], { cwd: path, stdio: "pipe" });
    } catch {}
  }
  ok({ name, upgraded: true });
}

/** Exposed to the dispatcher so unknown subcommands can be routed to extensions. */
export function findExtensionBin(name: string): string | null {
  const path = join(EXT_HOME, name, `o-browser-${name}`);
  if (!existsSync(path)) return null;
  try {
    const st = statSync(path);
    if (!st.isFile()) return null;
  } catch {
    return null;
  }
  return path;
}
