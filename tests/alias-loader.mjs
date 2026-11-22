import { existsSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
const SRC = new URL("../src/", import.meta.url);
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    let p = fileURLToPath(new URL(specifier.slice(2), SRC));
    if (!existsSync(p) && existsSync(p + ".js")) p += ".js";
    return next(pathToFileURL(p).href, context);
  }
  return next(specifier, context);
}
