/**
 * Re-route console.log/info/warn/error to stderr so JSON output on stdout stays clean.
 *
 * Imported as the first thing in cli/o-browser.ts (before any module that uses console).
 * The CLI emits structured output via process.stdout.write() in lib/output.ts,
 * which bypasses console and is unaffected by this re-routing.
 */

function toStderr(...args: any[]) {
  const line = args
    .map((a) => (typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()))
    .join(" ");
  process.stderr.write(line + "\n");
}

console.log = toStderr;
console.info = toStderr;
console.warn = toStderr;
console.error = toStderr;
console.debug = toStderr;
