/**
 * Component styles. A `css` literal becomes one constructable stylesheet,
 * adopted by the document when the module loads, whose rules are wrapped
 * in an @scope block keyed by a class derived from the text. The scope's
 * lower bound is the interior of any nested scoped component: a parent can
 * style a child's root element but nothing inside it. There is no shadow
 * DOM, so design tokens, resets, and global stylesheets apply as usual.
 */
import { fail } from "./diagnostics.js";
/** The class every scoped root carries, used as the lower bound of enclosing scopes. */
export const SCOPE_MARKER = "zl-s";
class ScopedStyles {
    scope;
    text;
    /** The rules as written, before wrapping, so a sheet can be composed into another. */
    rules;
    constructor(scope, rules, text) {
        this.scope = scope;
        this.rules = rules;
        this.text = text;
    }
    toString() {
        return SCOPE_MARKER + " " + this.scope;
    }
}
/** FNV-1a over the text, rendered in base 36, so the same CSS always gets the same class. */
function hash(text) {
    let value = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        value ^= text.charCodeAt(i);
        value = Math.imul(value, 0x01000193);
    }
    return (value >>> 0).toString(36);
}
const sheets = new Map();
/** Every stylesheet created so far, in creation order, for server rendering. */
export function styleSheets() {
    return [...sheets.values()];
}
function adopt(text) {
    if (typeof document === "undefined" || typeof CSSStyleSheet === "undefined") {
        return;
    }
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
/**
 * Declares scoped component styles. Values may be numbers or other `css`
 * results; strings are rejected so untrusted text can never become CSS.
 */
export function css(strings, ...values) {
    let rules = strings[0] ?? "";
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (typeof value === "number") {
            rules += String(value);
        }
        else if (value instanceof ScopedStyles) {
            rules += value.rules;
        }
        else {
            throw fail("css_value_not_allowed", { index: i, type: typeof value });
        }
        rules += strings[i + 1] ?? "";
    }
    const cached = sheets.get(rules);
    if (cached !== undefined) {
        return cached;
    }
    const scope = "zl-" + hash(rules);
    const text = `@scope (.${scope}) to (:scope .${SCOPE_MARKER} > *) {\n${rules}\n}`;
    const styles = new ScopedStyles(scope, rules, text);
    sheets.set(rules, styles);
    adopt(text);
    return styles;
}
