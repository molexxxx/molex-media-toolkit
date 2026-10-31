/**
 * The template scanner: the static strings of an `html` literal become
 * markup with markers and a part table, in one pass over the characters.
 * Pure and usable without a DOM, so a build tool runs the same scan ahead
 * of time and the runtime never has to.
 */
import { fail } from "./diagnostics.js";
import { ATTRIBUTE, BOOLEAN, CHILD, CHILD_MARKER, EVENT, MARK, PROPERTY, REF } from "./parts.js";
const TEXT = 0;
const TAG = 1;
const EQUALS = 2;
const DOUBLE = 3;
const SINGLE = 4;
const UNQUOTED = 5;
const COMMENT = 6;
const RAW = 7;
const RAW_TAGS = new Set(["style", "textarea", "title"]);
const UNSAFE_PROPERTIES = new Set(["innerHTML", "outerHTML", "srcdoc"]);
const UNSAFE_ATTRIBUTES = new Set(["srcdoc"]);
function isSpace(c) {
    return c === " " || c === "\n" || c === "\t" || c === "\r" || c === "\f";
}
function isNameStart(c) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}
function attributeSpec(name, strings) {
    let kind = ATTRIBUTE;
    let actual = name;
    const prefix = name[0];
    if (prefix === ".") {
        kind = PROPERTY;
        actual = name.slice(1);
    }
    else if (prefix === "?") {
        kind = BOOLEAN;
        actual = name.slice(1);
    }
    else if (prefix === "@") {
        kind = EVENT;
        actual = name.slice(1);
    }
    else if (name.toLowerCase() === "ref") {
        kind = REF;
    }
    if (kind !== ATTRIBUTE && (strings.length !== 2 || strings[0] !== "" || strings[1] !== "")) {
        throw fail("binding_not_single", { name });
    }
    if (kind === PROPERTY && UNSAFE_PROPERTIES.has(actual)) {
        throw fail("unsafe_property_binding", { name: actual });
    }
    const lower = actual.toLowerCase();
    if (kind === ATTRIBUTE && (UNSAFE_ATTRIBUTES.has(lower) || lower.startsWith("on"))) {
        throw fail("unsafe_attribute_binding", { name: actual });
    }
    return { kind, index: -1, name: actual, strings, count: strings.length - 1 };
}
/** Scans the static strings of a template literal. Pure; usable without a DOM. */
export function scan(strings) {
    const parts = [];
    let markup = "";
    let state = TEXT;
    let tag = "";
    let closing = false;
    let inTagName = false;
    let attr = "";
    let inAttrName = false;
    let attrStart = 0;
    let segment = 0;
    let bound;
    let raw = "";
    const finish = (end) => {
        if (bound === undefined) {
            return;
        }
        bound.strings.push(markup.slice(segment, end));
        const spec = attributeSpec(bound.name, bound.strings);
        markup = markup.slice(0, bound.start) + MARK + parts.length + markup.slice(end);
        parts.push(spec);
        bound = undefined;
    };
    const bind = () => {
        if (bound === undefined) {
            bound = { name: attr, strings: [], start: attrStart };
        }
        bound.strings.push(markup.slice(segment));
        segment = markup.length;
    };
    for (let i = 0; i < strings.length; i++) {
        const s = strings[i] ?? "";
        for (let j = 0; j < s.length; j++) {
            const c = s[j] ?? "";
            const pos = markup.length;
            switch (state) {
                case TEXT:
                    if (c === "<") {
                        const next = s[j + 1];
                        if (s.startsWith("!--", j + 1)) {
                            state = COMMENT;
                        }
                        else if (next !== undefined && (isNameStart(next) || next === "/")) {
                            state = TAG;
                            tag = "";
                            inTagName = true;
                            closing = next === "/";
                        }
                    }
                    break;
                case COMMENT:
                    if (c === ">" && markup.endsWith("--")) {
                        state = TEXT;
                    }
                    break;
                case RAW:
                    if (c === "<" && s.slice(j + 1, j + 2 + raw.length).toLowerCase() === "/" + raw) {
                        state = TAG;
                        tag = "";
                        inTagName = true;
                        closing = true;
                    }
                    break;
                case TAG:
                    if (inTagName) {
                        if (c === "/" && tag === "") {
                            break;
                        }
                        if (isSpace(c) || c === ">" || c === "/") {
                            inTagName = false;
                        }
                        else {
                            tag += c.toLowerCase();
                            break;
                        }
                    }
                    if (inAttrName) {
                        if (c === "=" || isSpace(c) || c === ">" || c === "/") {
                            inAttrName = false;
                        }
                        else {
                            attr += c;
                            break;
                        }
                    }
                    if (c === "=") {
                        state = EQUALS;
                        break;
                    }
                    if (c === ">") {
                        state = TEXT;
                        if (!closing) {
                            if (tag === "script") {
                                throw fail("script_in_template");
                            }
                            if (RAW_TAGS.has(tag)) {
                                state = RAW;
                                raw = tag;
                            }
                        }
                        break;
                    }
                    if (isSpace(c) || c === "/") {
                        break;
                    }
                    inAttrName = true;
                    attr = c;
                    attrStart = pos;
                    break;
                case EQUALS:
                    if (isSpace(c)) {
                        break;
                    }
                    if (c === "\"") {
                        state = DOUBLE;
                        segment = pos + 1;
                        break;
                    }
                    if (c === "'") {
                        state = SINGLE;
                        segment = pos + 1;
                        break;
                    }
                    state = UNQUOTED;
                    segment = pos;
                    break;
                case DOUBLE:
                case SINGLE:
                    if (c === (state === DOUBLE ? "\"" : "'")) {
                        const had = bound !== undefined;
                        finish(pos);
                        state = TAG;
                        if (had) {
                            continue;
                        }
                    }
                    break;
                case UNQUOTED:
                    if (isSpace(c) || c === ">") {
                        finish(pos);
                        state = TAG;
                        j--;
                        continue;
                    }
                    break;
                default:
                    break;
            }
            markup += c;
        }
        if (i < strings.length - 1) {
            switch (state) {
                case TEXT:
                    if (markup.endsWith("<")) {
                        throw fail("binding_in_tag_position");
                    }
                    markup += CHILD_MARKER;
                    parts.push({ kind: CHILD, index: -1, name: "", strings: [], count: 1 });
                    break;
                case EQUALS:
                    state = UNQUOTED;
                    segment = markup.length;
                    bind();
                    break;
                case DOUBLE:
                case SINGLE:
                case UNQUOTED:
                    bind();
                    break;
                case COMMENT:
                    throw fail("binding_in_comment");
                case RAW:
                    throw fail("binding_in_raw_text", { tag: raw });
                default:
                    throw fail("binding_in_tag_position");
            }
        }
    }
    if (state !== TEXT) {
        throw fail("template_unclosed_tag");
    }
    return { markup, parts };
}
