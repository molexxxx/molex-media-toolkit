import { fail } from "./diagnostics.js";
/** Fragments lower to a template with no root element; the marker exists only for the types. */
export const Fragment = Symbol("zerolith.fragment");
/** Reached only when JSX was not lowered; throws a diagnostic. */
export function jsx() {
    throw fail("jsx_not_lowered", {});
}
/** The same as `jsx`. */
export const jsxs = jsx;
/** The same as `jsx`. */
export const jsxDEV = jsx;
