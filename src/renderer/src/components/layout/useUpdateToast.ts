/**
 * @module components/layout/useUpdateToast
 * The app update notice: once a new version has downloaded in the background, a toast offers to restart and install
 * it. Later dismisses it, and the update then installs the next time molexMedia quits. A running batch holds the
 * restart back until it finishes, and the toast says so.
 */
import { useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/appStore'
import { toast } from '../../ui'

/** The toast key, so a second ready update replaces the first notice instead of stacking under it. */
export const UPDATE_TOAST_KEY = 'app-update'

/** The words of the update toast. */
export const UPDATE_TOAST_WORDS = {
  readyBody: 'Restart to install it now, or it installs the next time you quit.',
  restart: 'Restart to install',
  later: 'Later',
  waitingBody: 'molexMedia restarts by itself once the jobs are done.',
  failed: 'The update could not install'
} as const

/** The ready toast's title. */
export function readyTitle(version: string | null): string
{
  return version ? `molexMedia ${version} is ready` : 'A molexMedia update is ready'
}

/** Asks the updater to restart and install, and says what happened when it could not right away. */
async function restartToInstall(id: string): Promise<void>
{
  const result = await window.api.installUpdate({ whenIdle: true })
  if (result.ok)
  {
    return
  }
  if (result.reason === 'batch-running')
  {
    toast.update(id, { title: result.message, body: UPDATE_TOAST_WORDS.waitingBody, actions: [] })
    return
  }
  toast.show({ key: UPDATE_TOAST_KEY, tone: 'error', title: UPDATE_TOAST_WORDS.failed, body: result.message })
}

/** Shows the update toast once per downloaded version, in the main window only. */
export function useUpdateToast(enabled: boolean): void
{
  const status = useAppStore((s) => s.updateStatus)
  const version = useAppStore((s) => s.updateVersion)
  const shownFor = useRef<string | null>(null)

  useEffect(() =>
  {
    if (!enabled || status !== 'downloaded')
    {
      return
    }
    const key = version ?? ''
    if (shownFor.current === key)
    {
      return
    }
    shownFor.current = key
    let id = ''
    id = toast.show({
      key: UPDATE_TOAST_KEY,
      tone: 'info',
      title: readyTitle(version),
      body: UPDATE_TOAST_WORDS.readyBody,
      persist: true,
      actions: [
        { label: UPDATE_TOAST_WORDS.restart, onAction: () => void restartToInstall(id) },
        { label: UPDATE_TOAST_WORDS.later, onAction: () => toast.dismiss(id) }
      ]
    })
  }, [enabled, status, version])
}
