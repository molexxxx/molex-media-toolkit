/**
 * The app update toast: it appears once a new version has downloaded, stays until acted on, restarts to install
 * through the updater with the batch held back when one runs, and shows once per version.
 */
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readyTitle, UPDATE_TOAST_WORDS, useUpdateToast } from '../../../src/renderer/src/components/layout/useUpdateToast'
import { useAppStore } from '../../../src/renderer/src/stores/appStore'
import { clearToasts, ToastRegion, TOAST_WARNING_MS } from '../../../src/renderer/src/ui/Toast'

const installUpdate = vi.fn(async (_request?: { whenIdle?: boolean }) => ({ ok: true }) as const)

function Harness({ enabled = true }: { enabled?: boolean }): React.JSX.Element
{
  useUpdateToast(enabled)
  return <ToastRegion />
}

/** The visible toasts, not the live regions that speak them. */
function shownToasts(): HTMLElement[]
{
  return [...document.querySelectorAll<HTMLElement>('[data-toast-id]')].filter((el) => !el.hasAttribute('data-leaving'))
}

function ready(version: string | null): void
{
  act(() => useAppStore.setState({ updateStatus: 'downloaded', updateVersion: version }))
}

beforeEach(() =>
{
  ;(window as any).api = { ...(window as any).api, installUpdate }
  useAppStore.setState({ updateStatus: 'idle', updateVersion: null })
})

afterEach(() =>
{
  cleanup()
  act(() => clearToasts())
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('the update toast', () =>
{
  it('names the version, or says an update is ready without one', () =>
  {
    expect(readyTitle('5.2.0')).toBe('molexMedia 5.2.0 is ready')
    expect(readyTitle(null)).toBe('A molexMedia update is ready')
  })

  it('stays away until the update has downloaded, and out of the popout', () =>
  {
    render(<Harness enabled={false} />)
    ready('5.2.0')
    expect(shownToasts()).toHaveLength(0)
  })

  it('appears once the update has downloaded and stays until it is acted on', () =>
  {
    vi.useFakeTimers()
    render(<Harness />)
    act(() => useAppStore.setState({ updateStatus: 'downloading', updateVersion: '5.2.0' }))
    expect(shownToasts()).toHaveLength(0)
    ready('5.2.0')
    expect(shownToasts()).toHaveLength(1)
    expect(shownToasts()[0]).toHaveTextContent('molexMedia 5.2.0 is ready')
    expect(shownToasts()[0]).toHaveTextContent(UPDATE_TOAST_WORDS.readyBody)
    act(() => vi.advanceTimersByTime(TOAST_WARNING_MS * 3))
    expect(shownToasts()).toHaveLength(1)
  })

  it('restarts to install through the updater, asking it to wait for a running batch', async () =>
  {
    render(<Harness />)
    ready('5.2.0')
    fireEvent.click(screen.getByRole('button', { name: UPDATE_TOAST_WORDS.restart }))
    await waitFor(() => expect(installUpdate).toHaveBeenCalledWith({ whenIdle: true }))
  })

  it('says the restart waits for the batch when one runs', async () =>
  {
    installUpdate.mockResolvedValueOnce({ ok: false, reason: 'batch-running', message: 'An update is ready. It installs when batch 7 finishes.', whenIdle: true } as any)
    render(<Harness />)
    ready('5.2.0')
    fireEvent.click(screen.getByRole('button', { name: UPDATE_TOAST_WORDS.restart }))
    await waitFor(() => expect(shownToasts()[0]).toHaveTextContent('An update is ready. It installs when batch 7 finishes.'))
    expect(shownToasts()[0]).toHaveTextContent(UPDATE_TOAST_WORDS.waitingBody)
    expect(screen.queryByRole('button', { name: UPDATE_TOAST_WORDS.restart })).toBeNull()
  })

  it('names an install that could not start', async () =>
  {
    installUpdate.mockResolvedValueOnce({ ok: false, reason: 'failed', message: 'molexMedia could not install the update: disk full' } as any)
    render(<Harness />)
    ready('5.2.0')
    fireEvent.click(screen.getByRole('button', { name: UPDATE_TOAST_WORDS.restart }))
    await waitFor(() => expect(shownToasts()[0]).toHaveTextContent(UPDATE_TOAST_WORDS.failed))
    expect(shownToasts()[0]).toHaveTextContent('molexMedia could not install the update: disk full')
    expect(shownToasts()[0]).toHaveAttribute('data-tone', 'error')
  })

  it('goes away on Later and does not come back for the same version', () =>
  {
    render(<Harness />)
    ready('5.2.0')
    fireEvent.click(screen.getByRole('button', { name: UPDATE_TOAST_WORDS.later }))
    expect(shownToasts()).toHaveLength(0)
    act(() => useAppStore.setState({ updateStatus: 'error' }))
    ready('5.2.0')
    expect(shownToasts()).toHaveLength(0)
  })
})
