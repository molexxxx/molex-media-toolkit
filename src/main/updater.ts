/**
 * @module main/updater
 * @description Keeps molexMedia current from GitHub Releases through electron-updater. A packaged install checks a
 * few seconds after launch, every half hour, and when the window comes back after a while; it downloads a new
 * version in the background and installs it without the installer's windows, either when the reader restarts from
 * the update toast, which reopens the app on the new version, or the next time the app quits. A running batch holds
 * the restart back until it finishes. Every state change goes to each renderer as `updater:status`.
 */

import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { getConfigSync } from './config'
import { logger } from './logger'
import { sendToAll } from './ipc/helpers'
import { APP_NAME, updateWaitingText } from './jobs/status'
import {
  canCheck, CHECK_INTERVAL_MS, checksOnReturn, FIRST_CHECK_DELAY_MS, initialUpdateState, readyNotification, readyToAnnounce,
  reduceUpdate, updateSupport, type UpdateEvent, type UpdateState
} from './updater-rules'
import type { RunId } from '../shared/jobs/ids'
import type { UpdateInstallResult } from '../shared/ipc/api'

/** How often an install armed for when the engine is idle checks again. */
export const IDLE_INSTALL_POLL_MS = 5_000

/** How long after launch the startup check runs, so the window is ready for its events. */
export const STARTUP_CHECK_DELAY_MS = FIRST_CHECK_DELAY_MS

/** How long a check may take before it reports a timeout. */
export const CHECK_TIMEOUT_MS = 15_000

/** What `updater:install` returns: installing, or refused while the engine is busy. */
export type InstallResult = UpdateInstallResult

/** What the updater reads from the app lifecycle. */
export interface UpdaterOptions
{
  /** Whether the job engine is busy, and the run that keeps it busy. */
  busy(): { busy: boolean; runId: RunId | null }
  /** The async shutdown that flushes the job journal; it runs before the installer closes the windows. */
  beforeInstall(): Promise<void>
  /** Brings the main window back, for a click on the ready notification. */
  showWindow?(): void
}

/** The notice while a busy engine holds the update back. */
export function waitingText(runId: RunId | null): string
{
  return runId === null ? 'An update is ready. It installs when the current jobs finish.' : updateWaitingText(runId)
}

/** Whether a molexMedia window is showing and focused. */
function windowInFront(): boolean
{
  const focused = BrowserWindow.getFocusedWindow()
  return focused !== null && focused.isVisible()
}

/** Initializes the updater: wires events and IPC, and schedules the automatic checks. */
export async function initUpdater(options: UpdaterOptions): Promise<void>
{
  const support = updateSupport(process.platform, app.isPackaged, process.env.APPIMAGE)
  const downloads = support === 'auto'

  autoUpdater.autoDownload = downloads
  autoUpdater.autoInstallOnAppQuit = downloads
  autoUpdater.allowDowngrade = false
  autoUpdater.disableWebInstaller = false
  autoUpdater.logger = null
  if (!app.isPackaged)
  {
    autoUpdater.forceDevUpdateConfig = true
  }

  let state: UpdateState = initialUpdateState(support)
  let lastCheckAt: number | null = null
  let announced: string | null = null

  const announce = (): void =>
  {
    const key = readyToAnnounce(state, announced, windowInFront())
    if (key === null || !Notification.isSupported())
    {
      return
    }
    announced = key
    const notification = new Notification(readyNotification(state.version))
    notification.on('click', () => options.showWindow?.())
    notification.show()
  }

  const apply = (event: UpdateEvent): void =>
  {
    const next = reduceUpdate(state, event, downloads)
    if (next === state)
    {
      return
    }
    state = next
    sendToAll('updater:status', state)
    announce()
  }

  autoUpdater.on('checking-for-update', () =>
  {
    logger.info('Checking for updates…')
    apply({ kind: 'checking' })
  })
  autoUpdater.on('update-available', (info) =>
  {
    logger.info(`Update available: v${info.version}${downloads ? ', downloading' : ''}`)
    apply({ kind: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', (info) =>
  {
    logger.info(`App is up to date (v${info.version})`)
    apply({ kind: 'not-available', version: info.version })
  })
  autoUpdater.on('download-progress', (progress) => apply({ kind: 'progress', percent: progress.percent }))
  autoUpdater.on('update-downloaded', (info) =>
  {
    logger.info(`Update downloaded: v${info.version}; it installs on restart or quit`)
    apply({ kind: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) =>
  {
    logger.error(`Update error: ${err.message}`)
    apply({ kind: 'error', message: err.message })
  })

  const check = async (): Promise<{ success: boolean; version?: string; error?: string; manual?: boolean }> =>
  {
    if (support === 'manual')
    {
      sendToAll('updater:status', state)
      return { success: false, manual: true }
    }
    if (!canCheck(state.status))
    {
      return { success: true, version: state.version }
    }
    lastCheckAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    try
    {
      const timeout = new Promise<never>((_, reject) =>
      {
        timer = setTimeout(() => reject(new Error('Update check timed out')), CHECK_TIMEOUT_MS)
      })
      const result = await Promise.race([autoUpdater.checkForUpdates(), timeout])
      return { success: true, version: result?.updateInfo?.version }
    }
    catch (err: any)
    {
      return { success: false, error: err?.message ?? String(err) }
    }
    finally
    {
      clearTimeout(timer)
    }
  }

  const automatic = (): boolean => downloads && getConfigSync().autoUpdate !== false

  ipcMain.handle('updater:get-status', () => state)
  ipcMain.handle('updater:check', () => check())
  ipcMain.handle('updater:download', async () =>
  {
    try
    {
      await autoUpdater.downloadUpdate()
      return { success: true }
    }
    catch (err: any)
    {
      return { success: false, error: err?.message ?? String(err) }
    }
  })

  let idleInstall: ReturnType<typeof setInterval> | null = null
  let installing = false

  // Electron closes every window before before-quit in this path, so the engine shuts down first
  const install = async (): Promise<InstallResult> =>
  {
    if (installing)
    {
      return { ok: true }
    }
    if (state.status !== 'downloaded')
    {
      return { ok: false, reason: 'failed', message: `No ${APP_NAME} update is ready to install.` }
    }
    installing = true
    try
    {
      await options.beforeInstall()
      autoUpdater.quitAndInstall(true, true)
      return { ok: true }
    }
    catch (err: any)
    {
      installing = false
      logger.error(`Could not install the update: ${err?.message ?? String(err)}`)
      return { ok: false, reason: 'failed', message: `${APP_NAME} could not install the update: ${err?.message ?? String(err)}` }
    }
  }

  const armIdleInstall = (): void =>
  {
    if (idleInstall !== null)
    {
      return
    }
    idleInstall = setInterval(() =>
    {
      if (options.busy().busy)
      {
        return
      }
      if (idleInstall !== null)
      {
        clearInterval(idleInstall)
      }
      idleInstall = null
      logger.info('The batch finished; installing the update')
      void install()
    }, IDLE_INSTALL_POLL_MS)
  }

  ipcMain.handle('updater:install', async (_event, request?: { whenIdle?: boolean }): Promise<InstallResult> =>
  {
    const busy = options.busy()
    if (busy.busy)
    {
      const whenIdle = request?.whenIdle === true
      if (whenIdle)
      {
        armIdleInstall()
      }
      logger.info(`Update install held back: ${waitingText(busy.runId)}`)
      return { ok: false, reason: 'batch-running', message: waitingText(busy.runId), whenIdle }
    }
    return install()
  })

  if (support === 'manual')
  {
    setTimeout(() => sendToAll('updater:status', state), STARTUP_CHECK_DELAY_MS)
    return
  }
  if (support === 'dev')
  {
    return
  }

  setTimeout(() =>
  {
    if (!automatic())
    {
      logger.info('Startup update check skipped: automatic updates are off')
      return
    }
    void check()
  }, STARTUP_CHECK_DELAY_MS)

  setInterval(() =>
  {
    if (automatic())
    {
      void check()
    }
  }, CHECK_INTERVAL_MS)

  app.on('browser-window-focus', () =>
  {
    if (automatic() && checksOnReturn(state.status, lastCheckAt, Date.now()))
    {
      void check()
    }
  })
}
