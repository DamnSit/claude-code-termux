#!/usr/bin/env node
// Termux/Android patched launcher
// Patches: android -> linux for platform detection

const { spawnSync } = require('child_process')
const { arch, constants } = require('os')
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

function getBinaryPath() {
  const platformKey = getPlatformKey()
  const info = PLATFORMS[platformKey]
  if (!info) {
    console.error(
      `[${WRAPPER_NAME}] Unsupported platform: ${process.platform} ${arch()}. Supported: ${Object.keys(PLATFORMS).join(', ')}`,
    )
    process.exit(1)
  }
  try {
    const pkgDir = path.dirname(require.resolve(info.pkg + '/package.json'))
    return path.join(pkgDir, info.bin)
  } catch {
    console.error(
      `[${WRAPPER_NAME}] Could not find native binary package "${info.pkg}".`,
    )
    console.error('  Try reinstalling with: npm install')
    process.exit(1)
  }
}

function main() {
  const binaryPath = getBinaryPath()
  const result = spawnSync(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    env: { ...process.env, CLAUDE_CODE_INSTALLED_VIA_NPM_WRAPPER: '1' },
  })
  if (result.error) {
    console.error(
      `[${WRAPPER_NAME}] Failed to execute native binary at ` + binaryPath,
    )
    console.error('  ' + result.error.message)
    process.exit(1)
  }
  if (result.signal) {
    const signum = constants.signals[result.signal] ?? 0
    process.exit(128 + signum)
  } else {
    process.exit(result.status ?? 1)
  }
}

main()