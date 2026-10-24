/**
 * The AppImage repack's manifest handling: the published name comes from latest-linux.yml, the update information
 * wildcards the version, and the rewrite replaces only the AppImage entry's checksum and size, leaving the .deb and
 * .rpm entries as electron-builder wrote them.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkLauncher, defaultUpdateInfo, manifestAppImageName, patchManifest } from '../../../scripts/repack-appimage.mjs'

const MANIFEST = [
  'version: 5.2.0',
  'files:',
  '  - url: molexMedia-5.2.0-x86_64.AppImage',
  '    sha512: OLDAPPIMAGE==',
  '    size: 120000000',
  '    blockMapSize: 126000',
  '  - url: molexMedia-5.2.0-Linux-Installer.deb',
  '    sha512: DEB==',
  '    size: 101685720',
  '  - url: molexMedia-5.2.0-Linux-Installer.rpm',
  '    sha512: RPM==',
  '    size: 90782509',
  'path: molexMedia-5.2.0-x86_64.AppImage',
  'sha512: OLDAPPIMAGE==',
  "releaseDate: '2026-10-24T08:55:52.928Z'",
  ''
].join('\n')

let dir: string

beforeEach(() =>
{
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repack-'))
})

afterEach(() =>
{
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('the launcher check', () =>
{
  it('accepts a launcher that falls back to --no-sandbox where user namespaces are restricted, and refuses one without', () =>
  {
    const probe = 'if [ $HAVE_NO_SANDBOX -eq 0 ] && ! unshare -Ur true 2>/dev/null ; then\n  NO_SANDBOX=(--no-sandbox)\nfi'
    expect(() => checkLauncher(`#!/usr/bin/env bash\n${probe}\nexec "$BIN" "\${NO_SANDBOX[@]}"`)).not.toThrow()
    expect(() => checkLauncher('#!/usr/bin/env bash\nexec "$BIN" "$@"')).toThrow('no user-namespace probe')
  })
})

describe('the repack manifest', () =>
{
  it('reads the published AppImage name and refuses a manifest without exactly one', () =>
  {
    expect(manifestAppImageName(MANIFEST)).toBe('molexMedia-5.2.0-x86_64.AppImage')
    expect(() => manifestAppImageName('files:\n  - url: a.deb\n')).toThrow('found 0')
  })

  it('points AppImageUpdate at the latest release with the version wildcarded', () =>
  {
    expect(defaultUpdateInfo('molexMedia-5.2.0-x86_64.AppImage', '5.2.0'))
      .toBe('gh-releases-zsync|molexxxx|molex-media-toolkit|latest|molexMedia-*-x86_64.AppImage.zsync')
  })

  it('rewrites only the AppImage entry and the top-level checksum, dropping the stale block map', () =>
  {
    const file = path.join(dir, 'latest-linux.yml')
    fs.writeFileSync(file, MANIFEST)
    patchManifest(file, 'molexMedia-5.2.0-x86_64.AppImage', 'NEWAPPIMAGE==', 118000000)
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    expect(lines.slice(2, 5)).toEqual(['  - url: molexMedia-5.2.0-x86_64.AppImage', '    sha512: NEWAPPIMAGE==', '    size: 118000000'])
    expect(lines).not.toContain('    blockMapSize: 126000')
    expect(lines).toContain('    sha512: DEB==')
    expect(lines).toContain('    size: 101685720')
    expect(lines).toContain('    sha512: RPM==')
    expect(lines).toContain('sha512: NEWAPPIMAGE==')
    expect(lines).toContain('path: molexMedia-5.2.0-x86_64.AppImage')
  })

  it('keeps Windows line endings and refuses a manifest without the entry', () =>
  {
    const file = path.join(dir, 'latest-linux.yml')
    fs.writeFileSync(file, MANIFEST.replaceAll('\n', '\r\n'))
    patchManifest(file, 'molexMedia-5.2.0-x86_64.AppImage', 'NEW==', 1)
    expect(fs.readFileSync(file, 'utf8')).toContain('    sha512: NEW==\r\n')
    expect(() => patchManifest(file, 'other.AppImage', 'X==', 1)).toThrow('no files entry for other.AppImage')
  })
})
