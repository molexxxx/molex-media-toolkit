/**
 * Rules shared by the browser renderer and the server renderer, so a value
 * is treated the same way whichever one draws it.
 */
/** Attributes whose value is a URL the browser will navigate to or load. */
export declare const URL_ATTRIBUTES: ReadonlySet<string>;
/** True when a URL may be assigned to a navigating or loading attribute. */
export declare function safeUrl(value: string): boolean;
/** Joins the static strings of an attribute value with its resolved values; null and undefined read as empty. */
export declare function join(strings: readonly string[], values: readonly unknown[]): string;
/** Names a value's type for diagnostics. */
export declare function describe(value: unknown): string;
/** True for values that render as nothing. */
export declare function isNothing(value: unknown): value is null | undefined | boolean;
/** True for values that render as text. */
export declare function isText(value: unknown): value is string | number | bigint;
//# sourceMappingURL=binding.d.ts.map