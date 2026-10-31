/**
 * zerolith: a standalone frontend framework.
 *
 * The public surface is assembled here.
 */
export type { Applicability, Diagnostic, DiagnosticArgs, DiagnosticCode, DiagnosticListener, DiagnosticLocation, DiagnosticSeverity, DiagnosticSuggestion, DiagnosticText } from "./diagnostics.js";
export { DIAGNOSTIC_URL, ZerolithError, onDiagnostic } from "./diagnostics.js";
export { diagnosticCatalog } from "./catalog.js";
export type { EffectFunction, Equals, ReadableSignal, Scope, Signal, SignalOptions } from "./signals.js";
export { batch, computed, effect, onDispose, scope, signal, untracked } from "./signals.js";
export type { LoaderContext, Resource, ResourceOptions, ResourceStatus } from "./resource.js";
export { resource } from "./resource.js";
export type { HydrateResult, HydrationMismatch, KeyOf, MountTarget, Root, RowOf, View } from "./render.js";
export { each, html, hydrate, render, unsafeHtml, when } from "./render.js";
export type { PartSpec, PreparedPart, Scanned } from "./template.js";
export { prepared, scan } from "./template.js";
export type { Styles } from "./css.js";
export { SCOPE_MARKER, css } from "./css.js";
export type { FieldErrors, Problem } from "./problem.js";
export { PROBLEM_MEDIA_TYPE, isProblem } from "./problem.js";
export type { DevtoolsEvent, DevtoolsHook, NodeSnapshot, RootSnapshot } from "./devtools.js";
export { internal as devtoolsInternal, saveRestore as devtoolsSaveRestore } from "./devtools.js";
//# sourceMappingURL=index.d.ts.map