import type { Head, RouteTable, Router } from "./router.js";
/** Renders head metadata as the `<title>` and `<meta name="description">` elements of a server-rendered document. */
export declare function renderHead(head: Head): string;
/**
 * Renders the `<script>` that hands the current route's loaded data to the
 * browser, where the router reuses it for the initial navigation instead of
 * running the loader again, as long as the route and URL still match.
 * Empty when nothing matched or the route produced no data. The data goes
 * through JSON, so anything JSON cannot carry needs the loader to run.
 */
export declare function renderRouteState(router: Router<RouteTable>): string;
//# sourceMappingURL=server.d.ts.map