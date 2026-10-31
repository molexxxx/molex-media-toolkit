/**
 * The part table of a template: what the scanner produces from the static
 * strings of an `html` literal, and what rendering, hydration, and server
 * rendering bind values into.
 */
export const CHILD = 0;
export const ATTRIBUTE = 1;
export const BOOLEAN = 2;
export const PROPERTY = 3;
export const EVENT = 4;
export const REF = 5;
/** The marker the scanner leaves where a part binds: an attribute named `zl$N`, or a comment for a child. */
export const MARK = "zl$";
export const CHILD_MARKER = "<!--zl$-->";
