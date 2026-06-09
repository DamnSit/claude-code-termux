#!/usr/bin/env node
// Termux/Android patched launcher
// Patches: android -> linux for platform detection

const { spawnSync } = require('child_process')
const { arch, constants } = require('os')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PACKAGE_PREFIX = '@anthropic-ai/claude-code'
const BINARY_NAME = 'claude'
const WRAPPER_NAME = require('./package.json').name
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000

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

function readPackageJson(pkg) {
  const pkgJsonPath = require.resolve(pkg + '/package.json')
  return {
    dir: path.dirname(pkgJsonPath),
    json: require(pkgJsonPath),
  }
}

function getNativePackage(info) {
  const native = readPackageJson(info.pkg)
  return {
    ...native,
    binaryPath: path.join(native.dir, info.bin),
  }
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

function getStateFile() {
  return path.join(os.homedir(), '.cache', 'claude-code-termux', 'update-check.json')
}

function shouldCheckForUpdates(force) {
  if (force) return true
  if (process.env.CLAUDE_CODE_TERMUX_NO_AUTO_UPDATE === '1') return false

  try {
    const state = JSON.parse(fs.readFileSync(getStateFile(), 'utf8'))
    return Date.now() - Number(state.lastChecked || 0) > UPDATE_INTERVAL_MS
  } catch {
    return true
  }
}

function markUpdateChecked() {
  const file = getStateFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ lastChecked: Date.now() }) + '\n')
}

function npmViewLatest(pkg) {
  const command = process.env.npm_execpath ? process.execPath : 'npm'
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'view', pkg, 'version', '--silent']
    : ['view', pkg, 'version', '--silent']
  const result = spawnSync(command, args, {
    encoding: 'utf8',
  })
  if (result.status !== 0) return null
  return result.stdout.trim()
}

function npmInstallLatest(packages) {
  const command = process.env.npm_execpath ? process.execPath : 'npm'
  const installArgs = ['install', '-g', '--force', ...packages.map((pkg) => pkg + '@latest')]
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, ...installArgs]
    : installArgs
  const result = spawnSync(
    command,
    args,
    {
      stdio: 'inherit',
    },
  )
  return result.status === 0
}

function refreshNativePackage(info, force = false) {
  if (!shouldCheckForUpdates(force)) return

  let current = null
  try {
    current = readPackageJson(info.pkg).json.version
  } catch {}

  const latest = npmViewLatest(info.pkg)
  if (!latest) {
    if (force) {
      console.error(`[${WRAPPER_NAME}] Could not fetch latest ${info.pkg} version.`)
    }
    return
  }

  if (!current || compareVersions(latest, current) > 0 || force) {
    console.error(
      `[${WRAPPER_NAME}] Updating Claude Code native package ${current || 'missing'} -> ${latest}`,
    )
    npmInstallLatest([info.pkg])
  }

  markUpdateChecked()
}

function getBinaryPath(options = {}) {
  const platformKey = getPlatformKey()
  const info = PLATFORMS[platformKey]
  if (!info) {
    console.error(
      `[${WRAPPER_NAME}] Unsupported platform: ${process.platform} ${arch()}. Supported: ${Object.keys(PLATFORMS).join(', ')}`,
    )
    process.exit(1)
  }
  refreshNativePackage(info, options.forceUpdate)
  try {
    let native = getNativePackage(info)
    if (!fs.existsSync(native.binaryPath)) {
      console.error(
        `[${WRAPPER_NAME}] Native binary missing; reinstalling ${info.pkg}@latest...`,
      )
      npmInstallLatest([info.pkg])
      native = getNativePackage(info)
    }
    if (!fs.existsSync(native.binaryPath)) {
      throw new Error('native binary missing after install')
    }
    return native.binaryPath
  } catch {
    console.error(
      `[${WRAPPER_NAME}] Could not find native binary package "${info.pkg}".`,
    )
    console.error('  Try reinstalling with: npm install -g --force ' + info.pkg + '@latest')
    process.exit(1)
  }
}

function runNative(binaryPath, args) {
  const env = { ...process.env, CLAUDE_CODE_INSTALLED_VIA_NPM_WRAPPER: '1' }
  if (process.platform === 'android') {
    // cek grun dulu
    const grunCheck = spawnSync('which', ['grun'], { encoding: 'utf8' })
    if (grunCheck.status !== 0 || !grunCheck.stdout.trim()) {
      console.error(`[${WRAPPER_NAME}] ERROR: grun not found — run: pkg install glibc-runner`)
      process.exit(1)
    }
    return spawnSync('grun', [binaryPath, ...args], { stdio: 'inherit', env })
  }
  return spawnSync(binaryPath, args, { stdio: 'inherit', env })
}

function main() {
  const args = process.argv.slice(2)
  const forceUpdate = args[0] === 'update' || args[0] === '--update' || args[0] === '-update'

  if (forceUpdate) {
    getBinaryPath({ forceUpdate: true })
    process.exit(0)
  }

  const binaryPath = getBinaryPath()
  const result = runNative(binaryPath, args)
  if (result.error && result.error.code === 'ENOENT') {
    const retryPath = getBinaryPath({ forceUpdate: true })
    const retry = runNative(retryPath, args)
    if (!retry.error) {
      if (retry.signal) {
        const signum = constants.signals[retry.signal] ?? 0
        process.exit(128 + signum)
      }
      process.exit(retry.status ?? 1)
    }
  }
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
