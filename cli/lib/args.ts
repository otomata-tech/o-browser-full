/**
 * Minimal argv parser for CLI commands.
 *
 * Supports:
 *   - positional arguments
 *   - --flag (boolean) and --flag value
 *   - --param key=value (repeatable, collected into params object)
 */

export type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
  params: Record<string, any>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const params: Record<string, any> = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--param") {
      const kv = argv[++i];
      if (!kv) throw new Error("--param requires key=value");
      const eq = kv.indexOf("=");
      if (eq === -1) throw new Error(`--param expected key=value, got: ${kv}`);
      const key = kv.slice(0, eq);
      const raw = kv.slice(eq + 1);
      params[key] = parseParamValue(raw);
    } else if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[name] = true;
      } else {
        flags[name] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }

  return { positional, flags, params };
}

function parseParamValue(raw: string): any {
  if (raw === "") return "";
  const t = raw.trim();
  if (t.startsWith("{") || t.startsWith("[") || t === "true" || t === "false" || t === "null" || /^-?\d+(\.\d+)?$/.test(t)) {
    try {
      return JSON.parse(t);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function flagInt(flags: Record<string, string | boolean>, name: string, def: number): number {
  const v = flags[name];
  if (v === undefined || typeof v === "boolean") return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function flagStr(flags: Record<string, string | boolean>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

export function flagBool(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true || flags[name] === "true";
}
