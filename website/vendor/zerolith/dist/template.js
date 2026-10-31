/**
 * Template preparation. The static strings of an `html` literal are scanned
 * once into markup with markers and a part table, by the scanner at run
 * time or by a build tool ahead of time, then parsed into a `<template>`
 * through the Trusted Types policy. Parts are located by their position in
 * a tree walk, so binding a clone is a single walk with no searching.
 */
import { CHILD, MARK } from "./parts.js";
import { scan } from "./scan.js";
export { ATTRIBUTE, BOOLEAN, CHILD, EVENT, PROPERTY, REF } from "./parts.js";
export { scan } from "./scan.js";
let policy;
/** Passes template markup through the `zerolith` Trusted Types policy when the browser enforces one. */
export function trusted(markup) {
    if (policy === undefined) {
        const factory = globalThis.trustedTypes;
        policy = factory === undefined
            ? { createHTML: (input) => input }
            : factory.createPolicy("zerolith", { createHTML: (input) => input });
    }
    return policy.createHTML(markup);
}
const scans = new WeakMap();
const templates = new WeakMap();
/**
 * Registers the scan a build tool made of a template's strings, so the
 * runtime binds the template without scanning it, and returns the strings
 * for use as the tag's first argument:
 * `html(prepared(strings, markup, parts), ...values)`. The prepare pass in
 * `@zerolith/vite` emits these calls from what `scan` produced.
 */
export function prepared(strings, markup, parts) {
    scans.set(strings, {
        markup,
        parts: parts.map(([kind, name, pieces]) => ({ kind, index: -1, name, strings: pieces, count: kind === CHILD ? 1 : pieces.length - 1 }))
    });
    return strings;
}
/** The scan of a template's strings: the one registered ahead of time, or one made now and kept. */
export function scanned(strings) {
    let entry = scans.get(strings);
    if (entry === undefined) {
        entry = scan(strings);
        scans.set(strings, entry);
    }
    return entry;
}
const SHOW = 1 | 128;
/** Walks elements and comments in document order, the order parts are listed in. */
export function walker(root) {
    return document.createTreeWalker(root, SHOW);
}
/** Parses a template literal's strings once and locates its parts. */
export function prepare(strings) {
    const cached = templates.get(strings);
    if (cached !== undefined) {
        return cached;
    }
    const entry = scanned(strings);
    const parts = entry.parts.map((spec) => ({ ...spec }));
    const template = document.createElement("template");
    template.innerHTML = trusted(entry.markup);
    const walk = walker(template.content);
    let index = 0;
    let child = 0;
    for (let node = walk.nextNode(); node !== null; node = walk.nextNode(), index++) {
        if (node.nodeType === 1) {
            const element = node;
            const names = [];
            for (const attribute of element.attributes) {
                if (attribute.name.startsWith(MARK)) {
                    names.push(attribute.name);
                }
            }
            for (const name of names) {
                const spec = parts[Number(name.slice(MARK.length))];
                if (spec !== undefined) {
                    spec.index = index;
                }
                element.removeAttribute(name);
            }
        }
        else if (node.data === MARK) {
            while (child < parts.length && parts[child]?.kind !== CHILD) {
                child++;
            }
            const spec = parts[child];
            if (spec !== undefined) {
                spec.index = index;
            }
            child++;
        }
    }
    parts.sort((a, b) => a.index - b.index);
    const result = { content: template.content, parts };
    templates.set(strings, result);
    return result;
}
//# sourceMappingURL=template.js.map