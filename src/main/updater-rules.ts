/**
 * @module main/updater-rules
 * @description How the app updater's reported state moves as electron-updater raises its events, when it checks,
 * and which installs can replace themselves. Kept free of Electron so the rules are tested directly.
 */

/** What the updater reports to the renderer. */
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error' | 'manual'

/** The updater's reported state, as `updater:status` sends it. */
export interface UpdateState
{
  status: UpdateStatus
  version?: string
  percent?: number
  error?: string
}

/** The electron-updater events, reduced to what the state needs. */
export type UpdateEvent =
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'not-available'; version: string }
  | { kind: 'progress'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string }

/**
 * How an install updates: `auto` downloads in the background and installs on restart or quit, `dev` checks only on
 * request and never downloads, and `manual` is a Linux package that the system package manager replaces.
 */
export type UpdateSupport = 'auto' | 'dev' | 'manual'

/** How long after launch the first check runs. */
export const FIRST_CHECK_DELAY_MS = 5_000

/** How often the app checks after that; a batch app left in the tray can run for days. */
export const CHECK_INTERVAL_MS = 30 * 60_000

/** How old the last check may be before the window coming back to the front checks again. */
export const RETURN_CHECK_AFTER_MS = 10 * 60_000

/** The state before any check. */
export const IDLE_UPDATE: UpdateState = { status: 'idle' }

/**
 * Which update path this install has. electron-updater replaces the NSIS install on Windows, the app bundle on
 * macOS, and on Linux only an AppImage, which it finds through the `APPIMAGE` variable the AppImage runtime sets.
 * A .deb or .rpm install belongs to the package manager.
 */
export function updateSupport(platform: NodeJS.Platform, isPackaged: boolean, appImage: string | undefined): UpdateSupport
{
  if (!isPackaged)
  {
    return 'dev'
  }
  if (platform === 'linux' && !appImage)
  {
    return 'manual'
  }
  return 'auto'
}

/** The state an install starts in. */
export function initialUpdateState(support: UpdateSupport): UpdateState
{
  return support === 'manual' ? { status: 'manual' } : IDLE_UPDATE
}

/**
 * Applies an updater event. A downloaded update stays the state for the rest of the session, so a later check, or
 * one that fails, never hides the update waiting to install.
 * @param downloads Whether a found update downloads by itself; without it the state rests at `available`.
 */
export function reduceUpdate(state: UpdateState, event: UpdateEvent, downloads: boolean): UpdateState
{
  if (state.status === 'downloaded' || state.status === 'manual')
  {
    return state
  }
  switch (event.kind)
  {
    case 'checking':
      return state.status === 'downloading' ? state : { status: 'checking' }
    case 'available':
      return downloads ? { status: 'downloading', version: event.version, percent: 0 } : { status: 'available', version: event.version }
    case 'not-available':
      return { status: 'up-to-date', version: event.version }
    case 'progress':
      return { status: 'downloading', version: state.version, percent: Math.min(100, Math.max(0, Math.round(event.percent))) }
    case 'downloaded':
      return { status: 'downloaded', version: event.version }
    case 'error':
      return { status: 'error', error: event.message }
  }
}

/** Whether a check may start now: never while one is running or an update downloads or waits. */
export function canCheck(status: UpdateStatus): boolean
{
  return status !== 'checking' && status !== 'downloading' && status !== 'downloaded' && status !== 'manual'
}

/** Whether the window coming back to the front should check now: nothing under way and the last check old enough. */
export function checksOnReturn(status: UpdateStatus, lastCheckAt: number | null, now: number): boolean
{
  return canCheck(status) && (lastCheckAt === null || now - lastCheckAt >= RETURN_CHECK_AFTER_MS)
}

/**
 * Whether a ready update earns a system notification: once per version, and only while the window is out of
 * sight, since the window shows its own toast.
 * @returns The version to announce and remember, or null for nothing to say.
 */
export function readyToAnnounce(state: UpdateState, announced: string | null, inFront: boolean): string | null
{
  if (state.status !== 'downloaded' || inFront)
  {
    return null
  }
  const key = state.version ?? ''
  return key === announced ? null : key
}

/** The system notification for an update that finished downloading while the window was out of sight. */
export function readyNotification(version: string | undefined): { title: string; body: string }
{
  return {
    title: version ? `molexMedia ${version} is ready` : 'A molexMedia update is ready',
    body: 'Restart molexMedia to install it, or it installs the next time you quit.'
  }
}
