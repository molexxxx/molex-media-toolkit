/**
 * The app updater's rules: which installs update themselves, how the reported state follows electron-updater's
 * events with a downloaded update kept to the end of the session, when a check may run, and when a ready update
 * earns a system notification.
 */
import { describe, expect, it } from 'vitest'
import {
  canCheck, checksOnReturn, IDLE_UPDATE, initialUpdateState, readyNotification, readyToAnnounce, reduceUpdate,
  RETURN_CHECK_AFTER_MS, updateSupport, type UpdateState
} from '../../src/main/updater-rules'

describe('updateSupport', () =>
{
  it('updates packaged Windows and macOS installs and a Linux AppImage', () =>
  {
    expect(updateSupport('win32', true, undefined)).toBe('auto')
    expect(updateSupport('darwin', true, undefined)).toBe('auto')
    expect(updateSupport('linux', true, '/home/me/Apps/molexMedia-5.2.0-x86_64.AppImage')).toBe('auto')
  })

  it('leaves a .deb or .rpm install to the package manager and a development build to manual checks', () =>
  {
    expect(updateSupport('linux', true, undefined)).toBe('manual')
    expect(updateSupport('linux', true, '')).toBe('manual')
    expect(updateSupport('win32', false, undefined)).toBe('dev')
    expect(updateSupport('linux', false, '/tmp/x.AppImage')).toBe('dev')
  })

  it('starts a package-managed install as manual and every other one as idle', () =>
  {
    expect(initialUpdateState('manual')).toEqual({ status: 'manual' })
    expect(initialUpdateState('auto')).toBe(IDLE_UPDATE)
    expect(initialUpdateState('dev')).toBe(IDLE_UPDATE)
  })
})

describe('reduceUpdate', () =>
{
  it('goes from a check to a background download to a ready update', () =>
  {
    let state: UpdateState = IDLE_UPDATE
    state = reduceUpdate(state, { kind: 'checking' }, true)
    expect(state).toEqual({ status: 'checking' })
    state = reduceUpdate(state, { kind: 'available', version: '5.2.0' }, true)
    expect(state).toEqual({ status: 'downloading', version: '5.2.0', percent: 0 })
    state = reduceUpdate(state, { kind: 'progress', percent: 41.6 }, true)
    expect(state).toEqual({ status: 'downloading', version: '5.2.0', percent: 42 })
    state = reduceUpdate(state, { kind: 'downloaded', version: '5.2.0' }, true)
    expect(state).toEqual({ status: 'downloaded', version: '5.2.0' })
  })

  it('rests at available when a found update does not download by itself', () =>
  {
    expect(reduceUpdate({ status: 'checking' }, { kind: 'available', version: '5.2.0' }, false)).toEqual({ status: 'available', version: '5.2.0' })
  })

  it('reports up to date and errors, and clamps progress', () =>
  {
    expect(reduceUpdate({ status: 'checking' }, { kind: 'not-available', version: '5.1.1' }, true)).toEqual({ status: 'up-to-date', version: '5.1.1' })
    expect(reduceUpdate({ status: 'checking' }, { kind: 'error', message: 'offline' }, true)).toEqual({ status: 'error', error: 'offline' })
    expect(reduceUpdate({ status: 'downloading', version: '5.2.0', percent: 99 }, { kind: 'progress', percent: 140 }, true).percent).toBe(100)
    expect(reduceUpdate({ status: 'downloading', version: '5.2.0', percent: 1 }, { kind: 'progress', percent: -3 }, true).percent).toBe(0)
  })

  it('keeps a running download through a check event', () =>
  {
    const downloading: UpdateState = { status: 'downloading', version: '5.2.0', percent: 30 }
    expect(reduceUpdate(downloading, { kind: 'checking' }, true)).toBe(downloading)
  })

  it('keeps a ready update and a package-managed install whatever comes next', () =>
  {
    const ready: UpdateState = { status: 'downloaded', version: '5.2.0' }
    expect(reduceUpdate(ready, { kind: 'error', message: 'offline' }, true)).toBe(ready)
    expect(reduceUpdate(ready, { kind: 'not-available', version: '5.2.0' }, true)).toBe(ready)
    const manual: UpdateState = { status: 'manual' }
    expect(reduceUpdate(manual, { kind: 'checking' }, true)).toBe(manual)
  })
})

describe('when a check runs', () =>
{
  it('never starts while one runs or an update downloads or waits', () =>
  {
    expect(canCheck('idle')).toBe(true)
    expect(canCheck('up-to-date')).toBe(true)
    expect(canCheck('error')).toBe(true)
    expect(canCheck('available')).toBe(true)
    expect(canCheck('checking')).toBe(false)
    expect(canCheck('downloading')).toBe(false)
    expect(canCheck('downloaded')).toBe(false)
    expect(canCheck('manual')).toBe(false)
  })

  it('checks again when the window returns only after the last check is old enough', () =>
  {
    const now = 1_000_000_000
    expect(checksOnReturn('idle', null, now)).toBe(true)
    expect(checksOnReturn('up-to-date', now - RETURN_CHECK_AFTER_MS, now)).toBe(true)
    expect(checksOnReturn('up-to-date', now - RETURN_CHECK_AFTER_MS + 1, now)).toBe(false)
    expect(checksOnReturn('downloading', null, now)).toBe(false)
  })
})

describe('the ready notification', () =>
{
  const ready: UpdateState = { status: 'downloaded', version: '5.2.0' }

  it('announces a ready update once per version, only while the window is out of sight', () =>
  {
    expect(readyToAnnounce(ready, null, false)).toBe('5.2.0')
    expect(readyToAnnounce(ready, '5.2.0', false)).toBeNull()
    expect(readyToAnnounce(ready, null, true)).toBeNull()
    expect(readyToAnnounce({ status: 'downloading', version: '5.2.0', percent: 10 }, null, false)).toBeNull()
    expect(readyToAnnounce({ status: 'downloaded' }, null, false)).toBe('')
  })

  it('names the version and says how it installs', () =>
  {
    expect(readyNotification('5.2.0')).toEqual({
      title: 'molexMedia 5.2.0 is ready',
      body: 'Restart molexMedia to install it, or it installs the next time you quit.'
    })
    expect(readyNotification(undefined).title).toBe('A molexMedia update is ready')
  })
})
