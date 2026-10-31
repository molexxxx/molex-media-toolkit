/**
 * Media queries as signals, for the preferences a component should follow:
 * forced colors and reduced motion first.
 */
import { signal } from "zerolith";
const queries = new Map();
/** A media query as a signal that follows the query's matches; false wherever `matchMedia` does not exist, such as on the server. */
export function mediaQuery(query) {
    let existing = queries.get(query);
    if (existing === undefined) {
        if (typeof matchMedia === "undefined") {
            existing = signal(false);
        }
        else {
            const list = matchMedia(query);
            const matches = signal(list.matches);
            list.addEventListener("change", (event) => matches.set(event.matches));
            existing = matches;
        }
        queries.set(query, existing);
    }
    return existing;
}
/** True while the user agent is in forced colors mode, such as Windows high contrast, where author colors are replaced by system ones. */
export function forcedColors() {
    return mediaQuery("(forced-colors: active)");
}
/** True while the user has asked for reduced motion. */
export function reducedMotion() {
    return mediaQuery("(prefers-reduced-motion: reduce)");
}
//# sourceMappingURL=media.js.map