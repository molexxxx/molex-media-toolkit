/**
 * Stands in for the scanner in a bundle where every template was prepared
 * ahead of time: the prepare pass in `@zerolith/vite` points the core at
 * this module, so the scanner leaves the output and a template the build
 * never saw is reported instead of scanned.
 */
import { fail } from "./diagnostics.js";
/** Reports a template the build did not prepare. */
export function scan() {
    throw fail("template_not_prepared");
}
