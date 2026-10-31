import type { DiagnosticCode, DiagnosticText } from "./diagnostics.js";
/**
 * The message text for every diagnostic code. The documentation pages for
 * the codes are generated from this table, so an entry here is the single
 * source of truth for both the message and the docs. Production builds
 * ship an empty catalog, so look entries up with `?.`.
 */
export declare const diagnosticCatalog: Readonly<Partial<Record<DiagnosticCode, DiagnosticText>>>;
//# sourceMappingURL=catalog.d.ts.map