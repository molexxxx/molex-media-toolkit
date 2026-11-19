/** The per-user cache folder for `platform`. */
export function userCacheDir(env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform, home?: string): string

/** MOLEX_GOLDEN_OUT, or `molex-golden` in the user's cache folder. */
export function goldenRootFor(env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform, home?: string): string
