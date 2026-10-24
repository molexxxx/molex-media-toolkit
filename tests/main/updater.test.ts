/**
 * The app updater: a packaged install checks after the startup delay and every half hour while `autoUpdate` is on,
 * downloads a found update in the background, installs it silently and reopens the app when asked, holds the
 * install back while a batch runs, and on Linux updates only an AppImage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (...args: any[]) => unknown

const updaterEvents = new Map<string, Handler>()
const autoUpdater = {
  on: vi.fn((event: string, handler: Handler) => updaterEvents.set(event, handler)),
  checkForUpdates: vi.fn(async () => null),
  downloadUpdate: vi.fn(async () => undefined),
  quitAndInstall: vi.fn(),
  autoDownload: false,
  autoInstallOnAppQuit: false,
  allowDowngrade: true,
  disableWebInstaller: true,
  forceDevUpdateConfig: false,
  logger: {}
}
const ipcHandlers = new Map<string, Handler>()
const appEvents = new Map<string, Handler>()
const electronApp = { isPackaged: true, on: vi.fn((event: string, handler: Handler) => appEvents.set(event, handler)) }
const shown: { title: string; body: string }[] = []
const focused = { window: null as null | { isVisible(): boolean } }

class FakeNotification
{
  static isSupported(): boolean
  {
    return true
  }

  constructor(private readonly options: { title: string; body: string })
  {
  }

  on(): void
  {
  }

  show(): void
  {
    shown.push(this.options)
  }
}

const sendToAll = vi.fn()
const config = { autoUpdate: true }

vi.mock('electron-updater', () => ({ autoUpdater }))
vi.mock('electron', () => ({
  app: electronApp,
  ipcMain: { handle: (channel: string, handler: Handler) => ipcHandlers.set(channel, handler) },
  BrowserWindow: { getFocusedWindow: () => focused.window },
  Notification: FakeNotification
}))
vi.mock('../../src/main/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/main/ipc/helpers', () => ({ sendToAll: (...args: unknown[]) => sendToAll(...args) }))
vi.mock('../../src/main/jobs/status', () => ({ APP_NAME: 'molexMedia', updateWaitingText: (runId: string) => `waiting for ${runId}` }))
vi.mock('../../src/main/config', () => ({ getConfigSync: () => config }))

const { initUpdater, STARTUP_CHECK_DELAY_MS, IDLE_INSTALL_POLL_MS } = await import('../../src/main/updater')
const { CHECK_INTERVAL_MS, RETURN_CHECK_AFTER_MS } = await import('../../src/main/updater-rules')

const busy = { busy: false, runId: null as string | null }
const options = {
  busy: () => ({ ...busy }) as { busy: boolean; runId: any },
  beforeInstall: vi.fn(async () => undefined)
}

const realPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void
{
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

function emit(event: string, payload?: unknown): void
{
  updaterEvents.get(event)?.(payload)
}

function lastStatus(): unknown
{
  return sendToAll.mock.calls.filter(([channel]) => channel === 'updater:status').at(-1)?.[1]
}

beforeEach(() =>
{
  vi.useFakeTimers()
  config.autoUpdate = true
  electronApp.isPackaged = true
  busy.busy = false
  busy.runId = null
  focused.window = null
  shown.length = 0
  updaterEvents.clear()
  ipcHandlers.clear()
  appEvents.clear()
  delete process.env.APPIMAGE
  setPlatform('win32')
})

afterEach(() =>
{
  vi.useRealTimers()
  vi.clearAllMocks()
  setPlatform(realPlatform)
  delete process.env.APPIMAGE
})

describe('the automatic checks', () =>
{
  it('downloads in the background and installs on quit in a packaged install', async () =>
  {
    await initUpdater(options)
    expect(autoUpdater.autoDownload).toBe(true)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('checks after the startup delay and every half hour while automatic updates are on', async () =>
  {
    await initUpdater(options)
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('stays away while Settings turned automatic updates off', async () =>
  {
    config.autoUpdate = false
    await initUpdater(options)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2)
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('checks when the window comes back after a while, but not right after a check', async () =>
  {
    await initUpdater(options)
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS)
    appEvents.get('browser-window-focus')?.()
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(RETURN_CHECK_AFTER_MS)
    appEvents.get('browser-window-focus')?.()
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('swallows a failed check so the owner can retry from Settings', async () =>
  {
    autoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('offline'))
    await initUpdater(options)
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(sendToAll).not.toHaveBeenCalledWith('updater:status', expect.objectContaining({ status: 'error' }))
  })

  it('never checks or downloads by itself in a development build', async () =>
  {
    electronApp.isPackaged = false
    await initUpdater(options)
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS)
    expect(autoUpdater.autoDownload).toBe(false)
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })
})

describe('Linux', () =>
{
  it('reports a .deb or .rpm install as updated by its package manager, whatever the setting', async () =>
  {
    setPlatform('linux')
    config.autoUpdate = false
    await initUpdater(options)
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS)
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(sendToAll).toHaveBeenCalledWith('updater:status', { status: 'manual' })
    expect(await ipcHandlers.get('updater:check')?.()).toEqual({ success: false, manual: true })
  })

  it('updates an AppImage like the other platforms', async () =>
  {
    setPlatform('linux')
    process.env.APPIMAGE = '/home/me/Apps/molexMedia-5.2.0-x86_64.AppImage'
    await initUpdater(options)
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS)
    expect(autoUpdater.autoDownload).toBe(true)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
  })
})

describe('a found update', () =>
{
  it('reports the background download and the ready update', async () =>
  {
    await initUpdater(options)
    emit('update-available', { version: '5.2.0' })
    expect(lastStatus()).toEqual({ status: 'downloading', version: '5.2.0', percent: 0 })
    emit('download-progress', { percent: 55.2 })
    expect(lastStatus()).toEqual({ status: 'downloading', version: '5.2.0', percent: 55 })
    emit('update-downloaded', { version: '5.2.0' })
    expect(lastStatus()).toEqual({ status: 'downloaded', version: '5.2.0' })
    expect(await ipcHandlers.get('updater:get-status')?.()).toEqual({ status: 'downloaded', version: '5.2.0' })
  })

  it('stops checking once an update waits to install', async () =>
  {
    await initUpdater(options)
    emit('update-downloaded', { version: '5.2.0' })
    await vi.advanceTimersByTimeAsync(STARTUP_CHECK_DELAY_MS + CHECK_INTERVAL_MS)
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('sends a system notification only while the window is out of sight, once per version', async () =>
  {
    await initUpdater(options)
    emit('update-downloaded', { version: '5.2.0' })
    expect(shown).toEqual([{ title: 'molexMedia 5.2.0 is ready', body: 'Restart molexMedia to install it, or it installs the next time you quit.' }])
  })

  it('stays quiet while the window is in front, where the toast says it', async () =>
  {
    focused.window = { isVisible: () => true }
    await initUpdater(options)
    emit('update-downloaded', { version: '5.2.0' })
    expect(shown).toEqual([])
  })
})

describe('installing', () =>
{
  it('installs silently and reopens the app once the update is ready', async () =>
  {
    await initUpdater(options)
    expect(await ipcHandlers.get('updater:install')?.({}, {})).toEqual({ ok: false, reason: 'failed', message: 'No molexMedia update is ready to install.' })
    emit('update-downloaded', { version: '5.2.0' })
    expect(await ipcHandlers.get('updater:install')?.({}, {})).toEqual({ ok: true })
    expect(options.beforeInstall).toHaveBeenCalledTimes(1)
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('holds the install back while a batch runs, and installs when it finishes if asked to', async () =>
  {
    await initUpdater(options)
    emit('update-downloaded', { version: '5.2.0' })
    busy.busy = true
    busy.runId = 'run-7'
    expect(await ipcHandlers.get('updater:install')?.({}, { whenIdle: true })).toEqual({ ok: false, reason: 'batch-running', message: 'waiting for run-7', whenIdle: true })
    await vi.advanceTimersByTimeAsync(IDLE_INSTALL_POLL_MS)
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    busy.busy = false
    await vi.advanceTimersByTimeAsync(IDLE_INSTALL_POLL_MS)
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })
})
