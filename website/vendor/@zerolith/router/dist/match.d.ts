/**
 * Path patterns. A pattern is a sequence of static segments and `:name`
 * parameters, with an optional trailing `*rest` that captures the remainder.
 * Matching is pure so it can be tested without a DOM.
 */
/** The parameter names in a path pattern, derived at the type level. */
export type ParamsOf<Path extends string> = Path extends `${infer Head}/${infer Rest}` ? ParamsOf<Head> & ParamsOf<Rest> : Path extends `:${infer Name}` ? {
    [K in Name]: string;
} : Path extends `*${infer Name}` ? {
    [K in Name]: string;
} : {};
/** A compiled pattern. */
export interface Pattern {
    readonly source: string;
    readonly names: readonly string[];
    readonly expression: RegExp;
}
/** Compiles a pattern once. */
export declare function compile(path: string): Pattern;
/** Matches a pathname against a compiled pattern and returns the decoded parameters, or undefined. */
export declare function match(pattern: Pattern, pathname: string): Record<string, string> | undefined;
/** Builds a pathname from a pattern and parameters, encoding each value. */
export declare function build(path: string, params: Readonly<Record<string, string>>): string;
//# sourceMappingURL=match.d.ts.map