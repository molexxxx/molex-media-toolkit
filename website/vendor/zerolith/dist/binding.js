/**
 * Rules shared by the browser renderer and the server renderer, so a value
 * is treated the same way whichever one draws it.
 */
/** Attributes whose value is a URL the browser will navigate to or load. */
export const URL_ATTRIBUTES = new Set(["href", "src", "action", "formaction", "xlink:href", "poster"]);
/** True when a URL may be assigned to a navigating or loading attribute. */
export function safeUrl(value) {
    let scheme = "";
    for (const character of value) {
        if (character > " ") {
            scheme += character;
        }
    }
    scheme = scheme.toLowerCase();
    if (scheme.startsWith("javascript:") || scheme.startsWith("vbscript:")) {
        return false;
    }
    if (scheme.startsWith("data:")) {
        return /^data:image\/(?:png|gif|jpeg|jpg|webp|avif|bmp|x-icon)[;,]/.test(scheme);
    }
    return true;
}
/** Joins the static strings of an attribute value with its resolved values; null and undefined read as empty. */
export function join(strings, values) {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        text += (value === null || value === undefined ? "" : String(value)) + (strings[i + 1] ?? "");
    }
    return text;
}
/** Names a value's type for diagnostics. */
export function describe(value) {
    if (typeof value === "function") {
        return "function";
    }
    if (value === null) {
        return "null";
    }
    if (typeof value === "object") {
        return value.constructor?.name ?? "object";
    }
    return typeof value;
}
/** True for values that render as nothing. */
export function isNothing(value) {
    return value === null || value === undefined || typeof value === "boolean";
}
/** True for values that render as text. */
export function isText(value) {
    return typeof value === "string" || typeof value === "number" || typeof value === "bigint";
}
//# sourceMappingURL=binding.js.map