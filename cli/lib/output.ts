/**
 * Output formatting — JSON by default, --text for humans.
 */

export type Output = { ok: true; data?: any } | { ok: false; error: string; data?: any };

let format: "json" | "text" = "json";

export function setFormat(f: "json" | "text") {
  format = f;
}

export function emit(out: Output): never {
  if (format === "json") {
    process.stdout.write(JSON.stringify(out) + "\n");
  } else {
    if (out.ok) {
      if (out.data === undefined) {
        process.stdout.write("ok\n");
      } else if (typeof out.data === "string") {
        process.stdout.write(out.data + "\n");
      } else {
        process.stdout.write(JSON.stringify(out.data, null, 2) + "\n");
      }
    } else {
      process.stderr.write(`error: ${out.error}\n`);
      if (out.data !== undefined) process.stderr.write(JSON.stringify(out.data, null, 2) + "\n");
    }
  }
  process.exit(out.ok ? 0 : 1);
}

export function ok(data?: any): never {
  emit({ ok: true, data });
}

export function err(error: string, data?: any): never {
  emit({ ok: false, error, data });
}
