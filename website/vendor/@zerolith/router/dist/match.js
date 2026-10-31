/**
 * Path patterns. A pattern is a sequence of static segments and `:name`
 * parameters, with an optional trailing `*rest` that captures the remainder.
 * Matching is pure so it can be tested without a DOM.
 */
function escape(segment) {
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Compiles a pattern once. */
export function compile(path) {
    const names = [];
    const parts = [];
    for (const segment of path.split("/")) {
        if (segment === "") {
            continue;
        }
        if (segment.startsWith(":")) {
            names.push(segment.slice(1));
            parts.push("([^/]+)");
        }
        else if (segment.startsWith("*")) {
            names.push(segment.slice(1));
            parts.push("(.*)");
        }
        else {
            parts.push(escape(segment));
        }
    }
    return { source: path, names, expression: new RegExp("^/" + parts.join("/") + "/?$") };
}
/** Matches a pathname against a compiled pattern and returns the decoded parameters, or undefined. */
export function match(pattern, pathname) {
    const result = pattern.expression.exec(pathname === "" ? "/" : pathname);
    if (result === null) {
        return undefined;
    }
    const params = {};
    for (let i = 0; i < pattern.names.length; i++) {
        const name = pattern.names[i] ?? "";
        const value = result[i + 1] ?? "";
        params[name] = decodeURIComponent(value);
    }
    return params;
}
/** Builds a pathname from a pattern and parameters, encoding each value. */
export function build(path, params) {
    return path.replace(/[:*]([A-Za-z0-9_]+)/g, (_, name) => encodeURIComponent(params[name] ?? ""));
}
//# sourceMappingURL=match.js.map