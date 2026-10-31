/** Escapes text content. */
export declare function escapeText(text: string): string;
/** Escapes an attribute value for double quotes. */
export declare function escapeAttribute(text: string): string;
/**
 * Renders a view to HTML, with the markers `hydrate()` needs. Effects
 * created while rendering (inside `each` rows, `when` branches, and
 * computed values) are disposed before it returns. A component called
 * before `renderToString` runs outside that scope, exactly as in the
 * browser, and owns its own effects.
 */
export declare function renderToString(view: unknown): string;
/** A `<style>` element per `css` literal created so far, for the document head. */
export declare function renderStyles(): string;
//# sourceMappingURL=ssr.d.ts.map