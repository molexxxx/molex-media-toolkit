/**
 * Template preparation. The static strings of an `html` literal are scanned
 * once into markup with markers and a part table, by the scanner at run
 * time or by a build tool ahead of time, then parsed into a `<template>`
 * through the Trusted Types policy. Parts are located by their position in
 * a tree walk, so binding a clone is a single walk with no searching.
 */
import { type PartSpec, type PreparedPart, type Scanned } from "./parts.js";
export { ATTRIBUTE, BOOLEAN, CHILD, EVENT, PROPERTY, REF } from "./parts.js";
export type { PartSpec, PreparedPart, Scanned } from "./parts.js";
export { scan } from "./scan.js";
/** A parsed template and the parts to bind on each clone. */
export interface Prepared {
    content: DocumentFragment;
    parts: readonly PartSpec[];
}
/** Passes template markup through the `zerolith` Trusted Types policy when the browser enforces one. */
export declare function trusted(markup: string): string;
/**
 * Registers the scan a build tool made of a template's strings, so the
 * runtime binds the template without scanning it, and returns the strings
 * for use as the tag's first argument:
 * `html(prepared(strings, markup, parts), ...values)`. The prepare pass in
 * `@zerolith/vite` emits these calls from what `scan` produced.
 */
export declare function prepared(strings: readonly string[], markup: string, parts: readonly PreparedPart[]): TemplateStringsArray;
/** The scan of a template's strings: the one registered ahead of time, or one made now and kept. */
export declare function scanned(strings: readonly string[]): Scanned;
/** Walks elements and comments in document order, the order parts are listed in. */
export declare function walker(root: Node): TreeWalker;
/** Parses a template literal's strings once and locates its parts. */
export declare function prepare(strings: TemplateStringsArray): Prepared;
//# sourceMappingURL=template.d.ts.map