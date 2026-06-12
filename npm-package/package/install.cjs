#!/usr/bin/env node
// Termux/Android patched postinstall
// Patches: android -> linux for platform detection

console.error('[@xurxuo/claude-code-termux] Running postinstall script...')

const { spawnSync } = require('child_process')
const fs = require('fs')
const { arch } = require('os')
const path = require('path')

function isTermux() {
  const checks = {
    platform: process.platform === 'android',
    prefix: (process.env.PREFIX || '').includes('com.termux'),
    pkgExists: fs.existsSync('/data/data/com.termux/files/usr/bin/pkg'),
  }
  const result = checks.platform || checks.prefix || checks.pkgExists
  console.error(`[@xurxuo/claude-code-termux] Termux detection: ${result ? 'YES' : 'NO'} (platform=${checks.platform}, prefix=${checks.prefix}, pkg=${checks.pkgExists})`)
  return result
}

function binExists(bin) {
  const r = spawnSync('which', [bin], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim().length > 0
}

function ensureTermuxDeps() {
  console.error(`[@xurxuo/claude-code-termux] Checking Termux dependencies...`)

  const REQUIRED = [
    { pkg: 'glibc-runner', bin: 'grun' },
    { pkg: 'ripgrep',      bin: 'rg'   },
    { pkg: 'git',          bin: 'git'  },
  ]

  const missing = []
  for (const dep of REQUIRED) {
    const exists = binExists(dep.bin)
    console.error(`[@xurxuo/claude-code-termux]   ${dep.bin}: ${exists ? '✓ found' : '✗ missing'}`)
    if (!exists) {
      missing.push(dep)
    }
  }

  if (missing.length === 0) {
    console.error(`[@xurxuo/claude-code-termux] All dependencies present.`)
    return
  }

  console.error(`[@xurxuo/claude-code-termux] Installing ${missing.length} missing Termux package(s)...`)
  console.error(`[@xurxuo/claude-code-termux] Running: pkg update -y`)
  const updateResult = spawnSync('pkg', ['update', '-y'], { stdio: 'inherit' })
  if (updateResult.status !== 0) {
    console.error(`[@xurxuo/claude-code-termux] WARNING: pkg update failed, continuing anyway...`)
  }

  for (const { pkg, bin } of missing) {
    console.error(`[@xurxuo/claude-code-termux] Installing: ${pkg}`)
    const r = spawnSync('pkg', ['install', pkg, '-y'], { stdio: 'inherit' })
    if (r.status !== 0) {
      console.error(`[@xurxuo/claude-code-termux] ✗ FAILED to install ${pkg}`)
      console.error(`[@xurxuo/claude-code-termux]   You may need to run manually: pkg install ${pkg}`)
    } else {
      // Verify it actually installed
      if (binExists(bin)) {
        console.error(`[@xurxuo/claude-code-termux] ✓ ${pkg} installed successfully`)
      } else {
        console.error(`[@xurxuo/claude-code-termux] ⚠ ${pkg} installed but ${bin} not found in PATH`)
      }
    }
  }

  // Final verification
  console.error(`[@xurxuo/claude-code-termux] Final verification...`)
  const stillMissing = REQUIRED.filter(({ bin }) => !binExists(bin))
  if (stillMissing.length > 0) {
    console.error(`[@xurxuo/claude-code-termux] ⚠ WARNING: Some dependencies still missing:`)
    for (const { pkg, bin } of stillMissing) {
      console.error(`[@xurxuo/claude-code-termux]   - ${bin} (from ${pkg})`)
    }
    console.error(`[@xurxuo/claude-code-termux] Please run manually: pkg install ${stillMissing.map(d => d.pkg).join(' ')}`)
  } else {
    console.error(`[@xurxuo/claude-code-termux] ✓ All dependencies installed successfully`)
  }
}

if (isTermux()) ensureTermuxDeps()

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

function getNativePackage(pkg, bin) {
  const pkgDir = path.dirname(require.resolve(pkg + '/package.json'))
  const pkgJson = require(path.join(pkgDir, 'package.json'))
  const binaryPath = path.join(pkgDir, bin)
  return { pkgDir, pkgJson, binaryPath }
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
    const native = getNativePackage(info.pkg, info.bin)
    console.error(
      `[${WRAPPER_NAME} postinstall] Native package ready: ${info.pkg}@${native.pkgJson.version}`,
    )
    const latest = npmViewLatest(info.pkg)
    if (
      !fs.existsSync(native.binaryPath) ||
      (latest && compareVersions(latest, native.pkgJson.version) > 0)
    ) {
      installLatestNativePackage(info.pkg)
    }
  } catch {
    if (!installLatestNativePackage(info.pkg)) {
      console.error(
        `[${WRAPPER_NAME}] postinstall] Native package "${info.pkg}" not found and latest install failed.`,
      )
      console.error('  Try again with: npm install -g --force ' + info.pkg + '@latest')
      process.exitCode = 1
    }
  }
  // NOTE: we deliberately do NOT write a launcher to /usr/bin/claude here.
  // npm's `bin` field already links /usr/bin/claude -> cli-wrapper.cjs.
  // Writing through that symlink used to overwrite (corrupt) cli-wrapper.cjs
  // itself, turning `claude` into a silent no-op. The bin symlink is enough.
}

main()
