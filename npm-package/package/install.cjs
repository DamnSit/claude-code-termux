#!/usr/bin/env node
// Termux/Android patched postinstall
// Patches: android -> linux for platform detection

const { spawnSync } = require('child_process')
const { arch } = require('os')
const path = require('path')

const PACKAGE_PREFIX = '@anthropic-ai/claude-code'
const BINARY_NAME = 'claude'
const WRAPPER_NAME = require('./package.json').name

const PLATFORMS = {
  'darwin-arm64': { pkg: PACKAGE_PREFIX + '-darwin-arm64', bin: BINARY_NAME },
  'darwin-x64': { pkg: PACKAGE_PREFIX + '-darwin-x64', bin: BINARY_NAME },
  'linux-x64': { pkg: PACKAGE_PREFIX + '-linux-x64', bin: BINARY_NAME },
  'linux-arm64': { pkg: PACKAGE_PREFIX + '-linux-arm64', bin: BINARY_NAME },
  'linux-x64-musl': {
    pkg: PACKAGE_PREFIX + '-linux-x64-musl',
    bin: BINARY_NAME,
  },
  'linux-arm64-musl': {
    pkg: PACKAGE_PREFIX + '-linux-arm64-musl',
    bin: BINARY_NAME,
  },
  'win32-x64': {
    pkg: PACKAGE_PREFIX + '-win32-x64',
    bin: BINARY_NAME + '.exe',
  },
  'win32-arm64': {
    pkg: PACKAGE_PREFIX + '-win32-arm64',
    bin: BINARY_NAME + '.exe',
  },
}

function detectMusl() {
  // Termux: android is actually linux
  const platform = process.platform === 'android' ? 'linux' : process.platform
  if (platform !== 'linux') {
    return false
  }
  const report =
    typeof process.report?.getReport === 'function'
      ? process.report.getReport()
      : null
  return report != null && report.header?.glibcVersionRuntime === undefined
}

function getPlatformKey() {
  // Termux patch: android -> linux
  let platform = process.platform
  if (platform === 'android') {
    platform = 'linux'
  }
  let cpu = arch()

  // Termux is always arm64
  if (platform === 'linux' && cpu === 'arm64') {
    return 'linux-arm64'
  }

  if (platform === 'linux') {
    return 'linux-' + cpu + (detectMusl() ? '-musl' : '')
  }
  if (platform === 'darwin' && cpu === 'x64') {
    const r = spawnSync('sysctl', ['-n', 'sysctl.proc_translated'], {
      encoding: 'utf8',
    })
    if (r.stdout?.trim() === '1') {
      cpu = 'arm64'
    }
  }
  return platform + '-' + cpu
}

function installLatestNativePackage(pkg) {
  console.error(`[${WRAPPER_NAME} postinstall] Installing ${pkg}@latest...`)
  const command = process.env.npm_execpath ? process.execPath : 'npm'
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'install', '-g', '--force', pkg + '@latest']
    : ['install', '-g', '--force', pkg + '@latest']
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status === 0
}

function npmViewLatest(pkg) {
  const command = process.env.npm_execpath ? process.execPath : 'npm'
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'view', pkg, 'version', '--silent']
    : ['view', pkg, 'version', '--silent']
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  return result.status === 0 ? result.stdout.trim() : null
}

function compareVersions(a, b) {
  const left = String(a).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const right = String(b).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i++) {
    if ((left[i] || 0) > (right[i] || 0)) return 1
    if ((left[i] || 0) < (right[i] || 0)) return -1
  }
  return 0
}

function main() {
  const platformKey = getPlatformKey()
  const info = PLATFORMS[platformKey]

  if (!info) {
    console.error(
      `[${WRAPPER_NAME} postinstall] Unsupported platform: ${process.platform} ${arch()}`,
    )
    console.error(`  Supported: ${Object.keys(PLATFORMS).join(', ')}`)
    return
  }

  try {
    const pkgDir = path.dirname(require.resolve(info.pkg + '/package.json'))
    const pkgJson = require(path.join(pkgDir, 'package.json'))
    console.error(
      `[${WRAPPER_NAME} postinstall] Native package ready: ${info.pkg}@${pkgJson.version}`,
    )
    const latest = npmViewLatest(info.pkg)
    if (latest && compareVersions(latest, pkgJson.version) > 0) {
      installLatestNativePackage(info.pkg)
    }
  } catch {
    if (!installLatestNativePackage(info.pkg)) {
      console.error(
        `[${WRAPPER_NAME} postinstall] Native package "${info.pkg}" not found and latest install failed.`,
      )
      console.error('  Try again with: npm install -g --force ' + info.pkg + '@latest')
      process.exitCode = 1
    }
  }
}

main()
