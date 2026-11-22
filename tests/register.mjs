// Lets plain Node load the app's validators/utilities: resolves "@/..." to ./src/... (adds .js when missing).
import { register } from "node:module";
register("./alias-loader.mjs", import.meta.url);
