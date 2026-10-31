/** The class every scoped root carries, used as the lower bound of enclosing scopes. */
export declare const SCOPE_MARKER: string;
/** A stylesheet produced by `css`. Bind it to a root element's class attribute. */
export interface Styles {
    /** The generated class that selects this component's roots. */
    readonly scope: string;
    /** The full stylesheet text including the @scope wrapper, for server rendering. */
    readonly text: string;
    /** The class names to put on a root element: the shared marker plus `scope`. */
    toString(): string;
}
/** Every stylesheet created so far, in creation order, for server rendering. */
export declare function styleSheets(): readonly Styles[];
/**
 * Declares scoped component styles. Values may be numbers or other `css`
 * results; strings are rejected so untrusted text can never become CSS.
 */
export declare function css(strings: TemplateStringsArray, ...values: ReadonlyArray<number | Styles>): Styles;
//# sourceMappingURL=css.d.ts.map