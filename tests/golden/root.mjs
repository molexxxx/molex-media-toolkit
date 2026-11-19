/**
 * Where the golden suite keeps FFmpeg builds, the corpus, run outputs, and reports between runs. The vitest global
 * setup and the standalone FFmpeg fetch script both resolve the folder here.
 */
import { homedir } from 'node:os'
import { posix, resolve, win32 } from 'node:path'

/**
 * The per-user cache folder: %LOCALAPPDATA% on Windows, ~/Library/Caches on macOS, and $XDG_CACHE_HOME or ~/.cache
 * elsewhere. An empty or relative variable is ignored, as the XDG base directory spec requires.
 */
export function userCacheDir(env = process.env, platform = process.platform, home = homedir())
{
  const path = pathFor(platform)
  const absolute = (value) => (value && path.isAbsolute(value) ? value : null)
  if (platform === 'win32') return absolute(env.LOCALAPPDATA) ?? path.join(home, 'AppData', 'Local')
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches')
  return absolute(env.XDG_CACHE_HOME) ?? path.join(home, '.cache')
}

/**
 * MOLEX_GOLDEN_OUT, or `molex-golden` in the user's cache folder. The suite executes the FFmpeg builds it keeps
 * there, so the default is a folder only this user can write, never the shared temp folder.
 */
export function goldenRootFor(env = process.env, platform = process.platform, home = homedir())
{
  const chosen = env.MOLEX_GOLDEN_OUT?.trim()
  if (chosen) return resolve(chosen)
  return pathFor(platform).join(userCacheDir(env, platform, home), 'molex-golden')
}

function pathFor(platform)
{
  return platform === 'win32' ? win32 : posix
}
