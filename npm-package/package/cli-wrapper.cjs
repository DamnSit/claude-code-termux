#!/usr/bin/env node
// Termux/Android patched launcher
// Patches: android -> linux for platform detection

const { spawnSync } = require('child_process')
const { arch, constants } = require('os')
const fs = require('fs')
const os = require('os')
const path = require('path')
const readline = require('readline')

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

function isTermux() {
  return (
    process.platform === 'android' ||
    (process.env.PREFIX || '').includes('com.termux') ||
    fs.existsSync('/data/data/com.termux/files/usr/bin/pkg')
  )
}

function binExists(bin) {
  const r = spawnSync('which', [bin], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim().length > 0
}

// ─── Resolve grun (glibc-runner) ─────────────────────────────────────────────
// `grun` ships with the `glibc-runner` package. Depending on the build it lands
// in $PREFIX/bin/grun or under $PREFIX/glibc/bin/grun (the latter is NOT on PATH,
// so `which grun` fails even though glibc-runner is installed). Resolve it across
// PATH + known absolute locations and return the full path (or null).
function resolveGrun() {
  const w = spawnSync('which', ['grun'], { encoding: 'utf8' })
  if (w.status === 0 && w.stdout.trim()) return w.stdout.trim()
  const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr'
  const candidates = [
    PREFIX + '/bin/grun',
    PREFIX + '/glibc/bin/grun',
    '/data/data/com.termux/files/usr/bin/grun',
    '/data/data/com.termux/files/usr/glibc/bin/grun',
  ]
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c } catch {}
  }
  return null
}

// ─── Self-healing: ensure grun exists (runs at most once per invocation) ─────
// install.cjs postinstall may be blocked by npm allow-scripts, so resolve/install
// grun lazily here. NOTE: there is no package named `grun`; it is `glibc-runner`.
let _grunPath = null
let _grunInstallTried = false
function ensureGrun() {
  if (_grunPath) return _grunPath
  if (!isTermux()) { _grunPath = resolveGrun(); return _grunPath }

  let g = resolveGrun()
  if (g) { _grunPath = g; return g }

  if (!_grunInstallTried) {
    _grunInstallTried = true
    console.error(`[${WRAPPER_NAME}] grun (glibc-runner) not found — installing once...`)
    spawnSync('pkg', ['install', 'glibc-repo', '-y'], { stdio: 'inherit' })
    spawnSync('pkg', ['update', '-y'], { stdio: 'inherit' })
    spawnSync('pkg', ['install', 'glibc-runner', '-y'], { stdio: 'inherit' })
    g = resolveGrun()
    if (!g) {
      console.error(`[${WRAPPER_NAME}] grun still missing — repairing glibc-runner...`)
      spawnSync('pkg', ['install', '--reinstall', 'glibc-runner', '-y'], { stdio: 'inherit' })
      g = resolveGrun()
    }
    if (g) console.error(`[${WRAPPER_NAME}] ✓ grun ready: ${g}`)
  }
  _grunPath = g
  return g
}

// ─── Self-healing: ensure a working local DNS resolver for the glibc side ────
// The glibc-linked native binary (invoked via grun) does its own getaddrinfo()
// against the real /etc/resolv.conf, which ENOENTs on Android — there's no
// such file at that absolute path, Termux or not. The known fallback in that
// situation is 127.0.0.1:53, so keep a tiny local forwarder listening there,
// seeded with the device's actual DNS servers, so that fallback resolves
// instead of refusing (old failure mode) or hanging to a timeout (current one).
// No-ops if something is already listening. Opt out with
// CLAUDE_CODE_TERMUX_NO_DNS_HELPER=1.
let _resolverChecked = false
function ensureResolver() {
  if (_resolverChecked) return
  _resolverChecked = true
  if (!isTermux()) return
  if (process.env.CLAUDE_CODE_TERMUX_NO_DNS_HELPER === '1') return

  const running = spawnSync('pgrep', ['-x', 'dnsmasq'], { encoding: 'utf8' })
  if (running.status === 0 && running.stdout.trim()) return // already up

  if (!binExists('dnsmasq')) {
    console.error(`[${WRAPPER_NAME}] dnsmasq not found — installing once...`)
    spawnSync('pkg', ['install', 'dnsmasq', '-y'], { stdio: 'inherit' })
    if (!binExists('dnsmasq')) {
      console.error(`[${WRAPPER_NAME}] ⚠ could not install dnsmasq — DNS inside the glibc binary may still fail`)
      return
    }
  }

  const prop = (k) => (spawnSync('getprop', [k], { encoding: 'utf8' }).stdout || '').trim()
  const dns1 = prop('net.dns1') || '8.8.8.8'
  const dns2 = prop('net.dns2') || '1.1.1.1'

  const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr'
  const conf = path.join(PREFIX, 'etc', 'dnsmasq-claude-code.conf')
  try {
    fs.writeFileSync(conf, [
      'no-resolv',
      'no-poll',
      'listen-address=127.0.0.1',
      'bind-interfaces',
      `server=${dns1}`,
      `server=${dns2}`,
    ].join('\n') + '\n')
    spawnSync('dnsmasq', ['-C', conf], { stdio: 'ignore' }) // daemonizes itself
    console.error(`[${WRAPPER_NAME}] ✓ local resolver up on 127.0.0.1:53 (upstream ${dns1}, ${dns2})`)
  } catch (e) {
    console.error(`[${WRAPPER_NAME}] ⚠ could not start local resolver: ${e.message}`)
  }
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

function npmGlobalRoot() {
  const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr'
  return path.join(PREFIX, 'lib', 'node_modules')
}

function installedVersion(pkg) {
  try {
    return require(path.join(npmGlobalRoot(), pkg, 'package.json')).version
  } catch {
    return null
  }
}

// If npm leaves cli-wrapper.cjs truncated/corrupt after an install (a known
// npm/mirror quirk on some Termux setups), restore it from GitHub so an update
// can never brick the launcher again.
function selfHealWrapper() {
  try {
    const wrapperPath = path.join(npmGlobalRoot(), WRAPPER_NAME, 'cli-wrapper.cjs')
    let content = ''
    try { content = fs.readFileSync(wrapperPath, 'utf8') } catch {}
    const intact = content.split('\n').length >= 50 && content.includes('runNative')
    if (intact) return true
    console.error(`[${WRAPPER_NAME}] Installed wrapper looks corrupt \u2014 restoring from GitHub...`)
    const url = 'https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/npm-package/package/cli-wrapper.cjs'
    const r = spawnSync('curl', ['-fsSL', url, '-o', wrapperPath], { stdio: 'inherit' })
    const ok = r.status === 0
    console.error(`[${WRAPPER_NAME}] ${ok ? '\u2713 wrapper restored from GitHub' : '\u26a0 could not restore wrapper (check network)'}`)
    return ok
  } catch {
    return false
  }
}

// `claude update` \u2014 bring BOTH the wrapper and the native Claude Code binary
// to their latest versions, then self-heal the wrapper file if needed.
function runUpdate() {
  const info = PLATFORMS[getPlatformKey()]
  const nativePkg = info ? info.pkg : null

  console.error(`[${WRAPPER_NAME}] Updating Claude Code to latest...`)

  const wBefore = installedVersion(WRAPPER_NAME)
  console.error(`[${WRAPPER_NAME}] \u2192 wrapper ${WRAPPER_NAME} (current ${wBefore || 'unknown'})`)
  npmInstallLatest([WRAPPER_NAME])
  selfHealWrapper()

  if (nativePkg) {
    const nBefore = installedVersion(nativePkg)
    console.error(`[${WRAPPER_NAME}] \u2192 native ${nativePkg} (current ${nBefore || 'unknown'})`)
    npmInstallLatest([nativePkg])
  }

  markUpdateChecked()

  const wAfter = installedVersion(WRAPPER_NAME)
  const nAfter = nativePkg ? installedVersion(nativePkg) : null
  console.error('')
  console.error(`[${WRAPPER_NAME}] \u2713 Update complete`)
  console.error(`[${WRAPPER_NAME}]   wrapper: ${wAfter || 'unknown'}`)
  console.error(`[${WRAPPER_NAME}]   native:  ${nAfter || 'unknown'}`)
  console.error(`[${WRAPPER_NAME}]   (wrapper changes apply on next \`claude\` launch)`)
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
    ensureResolver()
    // Run grun via PATH first — exactly what worked in 2.1.146. No `which`
    // gatekeeping: some Termux setups lack the `which` binary, which made the
    // old detection fail even though `grun` ran fine. Only if grun is genuinely
    // missing (ENOENT) do we self-heal once, then retry with a resolved path.
    let r = spawnSync('grun', [binaryPath, ...args], { stdio: 'inherit', env })
    if (r.error && r.error.code === 'ENOENT') {
      const grun = ensureGrun()
      if (!grun) {
        console.error(`[${WRAPPER_NAME}] ERROR: grun (glibc-runner) not found.`)
        console.error(`[${WRAPPER_NAME}]   Fix: pkg install glibc-repo && pkg update && pkg install --reinstall glibc-runner`)
        process.exit(1)
      }
      r = spawnSync(grun, [binaryPath, ...args], { stdio: 'inherit', env })
    }
    return r
  }
  return spawnSync(binaryPath, args, { stdio: 'inherit', env })
}

// ─── Manager TUI ──────────────────────────────────────────────────────────────

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', white: '\x1b[37m' }
const WIDTH = 50

function header(title) {
  const pad = Math.max(0, Math.floor((WIDTH - title.length - 2) / 2))
  return `${C.cyan}${C.bold}${'═'.repeat(WIDTH)}${C.reset}\n${C.cyan}║${' '.repeat(pad)}${C.reset}${C.white}${C.bold}${title}${C.reset}${C.cyan}${' '.repeat(WIDTH - pad - title.length - 2)}║${C.reset}\n${C.cyan}${C.bold}${'═'.repeat(WIDTH)}${C.reset}`
}

function bar(label, value, color) {
  const c = C[color] || C.white
  const maxVal = WIDTH - label.length - value.length - 8
  const barLen = Math.min(maxVal, Math.max(0, maxVal))
  return `  ${c}${label}:${C.reset} ${value} ${c}${'█'.repeat(barLen)}${C.reset}`
}

function spawnOutput(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false, ...opts })
  return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status || 0 }
}

function npm(args, silent = false) {
  const cmd = process.env.npm_execpath ? process.execPath : 'npm'
  const a = process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args
  const opts = silent ? { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' } : { stdio: 'inherit' }
  return spawnSync(cmd, a, opts)
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => { rl.question(question, (ans) => { rl.close(); res(ans) }) })
}

function npmViewPkg(pkg) {
  const r = spawnOutput('npm', ['view', pkg, 'version', '--silent'])
  return r.code === 0 ? r.stdout.trim() : null
}

function appendToBashrc(line) {
  try {
    const rc = path.join(os.homedir(), '.bashrc')
    const content = fs.readFileSync(rc, 'utf8')
    const filtered = content.split('\n').filter(l => !/^export\s+ANTHROPIC_API_KEY=/.test(l)).join('\n')
    fs.writeFileSync(rc, filtered + '\n' + line + '\n')
  } catch (e) {
    console.error(`  ${C.red}Failed to write .bashrc: ${e.message}${C.reset}`)
  }
}

// ─── Manager action functions ─────────────────────────────────────────────────

async function managerStatus() {
  console.clear()
  console.log(header('📊 STATUS'))
  console.log('')

  let wrapperVer = 'unknown'
  try { wrapperVer = require('/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/package.json').version } catch {}
  let nativeVer = 'unknown'
  try { nativeVer = require('/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/package.json').version } catch {}

  console.log(bar('Wrapper', `@xurxuo/claude-code-termux v${wrapperVer}`, 'cyan'))
  console.log(bar('Claude Binary', `v${nativeVer}`, 'cyan'))

  const latestWrapper = npmViewPkg('@xurxuo/claude-code-termux')
  const latestNative = npmViewPkg('@anthropic-ai/claude-code-linux-arm64')
  console.log(bar('Latest Wrapper', latestWrapper ? `v${latestWrapper}` : 'unavailable', latestWrapper && latestWrapper !== wrapperVer ? 'yellow' : 'green'))
  console.log(bar('Latest Native', latestNative ? `v${latestNative}` : 'unavailable', latestNative && latestNative !== nativeVer ? 'yellow' : 'green'))

  let lastCheck = 'never'
  try {
    const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.cache/claude-code-termux/update-check.json'), 'utf8'))
    if (state.lastChecked) lastCheck = new Date(Number(state.lastChecked)).toLocaleString()
  } catch {}
  console.log(bar('Last Update Check', lastCheck, 'dim'))

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || ''
  const keyStatus = apiKey ? `${apiKey.slice(0, 9)}...` : `${C.yellow}not set${C.reset}`
  console.log(bar('API Key', keyStatus, apiKey ? 'green' : 'yellow'))

  const grun = resolveGrun() || ''
  console.log(bar('glibc-runner (grun)', grun ? `✓ ${grun}` : `${C.red}✗ not found${C.reset}`, grun ? 'green' : 'red'))

  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerCheckUpdates() {
  console.clear()
  console.log(header('🔍 CHECK UPDATES'))
  console.log('')

  const wrapperCurr = (() => { try { return require('/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/package.json').version } catch { return null } })()
  const nativeCurr = (() => { try { return require('/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/package.json').version } catch { return null } })()
  const latestWrapper = npmViewPkg('@xurxuo/claude-code-termux')
  const latestNative = npmViewPkg('@anthropic-ai/claude-code-linux-arm64')

  const items = [
    ['Wrapper (@xurxuo/claude-code-termux)', wrapperCurr, latestWrapper],
    ['Native (@anthropic-ai/claude-code-linux-arm64)', nativeCurr, latestNative],
  ]

  let hasUpdate = false
  for (const [name, curr, latest] of items) {
    if (!latest) console.log(`  ${C.red}✗${C.reset} ${name}: ${C.red}Could not fetch${C.reset}`)
    else if (!curr) { console.log(`  ${C.yellow}○${C.reset} ${name}: ${C.yellow}not installed${C.reset} → latest: v${latest}`); hasUpdate = true }
    else if (curr !== latest) { console.log(`  ${C.yellow}↑${C.reset} ${name}: v${curr} → ${C.green}v${latest}${C.reset} ${C.green}(update available)${C.reset}`); hasUpdate = true }
    else console.log(`  ${C.green}✓${C.reset} ${name}: v${curr} ${C.green}(up to date)${C.reset}`)
  }

  console.log('')
  if (hasUpdate) console.log(`  ${C.yellow}Updates available! Run "Update Packages" to upgrade.${C.reset}`)
  else console.log(`  ${C.green}All packages are up to date.${C.reset}`)

  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerUpdatePackages() {
  console.clear()
  console.log(header('⬆️ UPDATE PACKAGES'))
  console.log('')
  console.log(`  ${C.cyan}Updating @xurxuo/claude-code-termux...${C.reset}`)
  const r1 = npm(['install', '-g', '--force', '@xurxuo/claude-code-termux@latest'])
  console.log(`  ${r1.status === 0 ? C.green + '✓' : C.red + '✗'} Wrapper ${r1.status === 0 ? 'updated' : 'update failed'}${C.reset}`)
  selfHealWrapper()
  console.log('')
  console.log(`  ${C.cyan}Updating @anthropic-ai/claude-code-linux-arm64...${C.reset}`)
  const r2 = npm(['install', '-g', '--force', '@anthropic-ai/claude-code-linux-arm64@latest'])
  console.log(`  ${r2.status === 0 ? C.green + '✓' : C.red + '✗'} Native ${r2.status === 0 ? 'updated' : 'update failed'}${C.reset}`)
  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerApiKey() {
  console.clear()
  console.log(header('🔑 MANAGE API KEY'))
  console.log('')

  const envKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || ''
  let bashrcKey = ''
  try {
    const lines = fs.readFileSync(path.join(os.homedir(), '.bashrc'), 'utf8').split('\n')
    for (const l of lines) {
      const m = l.match(/^export\s+ANTHROPIC_API_KEY=(.+)/)
      if (m) { bashrcKey = m[1].replace(/^['"]|['"]$/g, ''); break }
    }
  } catch {}

  const key = envKey || bashrcKey
  if (key) {
    console.log(`  Current key: ${C.green}${key.slice(0, 9)}...${C.reset}`)
    console.log('')
    const ans = await ask(`  ${C.yellow}Enter new API key (or press Enter to skip): ${C.reset}`)
    if (ans.trim()) { appendToBashrc(`export ANTHROPIC_API_KEY=${ans.trim()}`); console.log(`  ${C.green}✓ API key saved to ~/.bashrc${C.reset}`) }
    else console.log(`  ${C.dim}No changes made.${C.reset}`)
  } else {
    console.log(`  ${C.yellow}No API key found.${C.reset}`)
    console.log('')
    const ans = await ask(`  ${C.cyan}Enter your API key: ${C.reset}`)
    if (ans.trim()) { appendToBashrc(`export ANTHROPIC_API_KEY=${ans.trim()}`); console.log(`  ${C.green}✓ API key saved to ~/.bashrc${C.reset}`) }
  }
  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerReinstall() {
  console.clear()
  console.log(header('🔄 REINSTALL'))
  console.log('')
  const ans = await ask(`  ${C.yellow}This will remove and reinstall both packages. Continue? (type 'yes'): ${C.reset}`)
  if (ans.trim().toLowerCase() !== 'yes') { console.log(`  ${C.dim}Cancelled.${C.reset}`); await ask(`${C.dim}Press Enter to continue...${C.reset}`); return }
  console.log('')
  console.log(`  ${C.cyan}Uninstalling...${C.reset}`)
  npm(['uninstall', '-g', '@xurxuo/claude-code-termux', '@anthropic-ai/claude-code-linux-arm64'])
  console.log('')
  console.log(`  ${C.cyan}Installing...${C.reset}`)
  npm(['install', '-g', '--force', '@xurxuo/claude-code-termux@latest'])
  console.log('')
  console.log(`  ${C.green}✓ Reinstall complete!${C.reset}`)
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerUninstall() {
  console.clear()
  console.log(header('🗑️  UNINSTALL'))
  console.log('')
  const ans = await ask(`  ${C.red}Type 'yes' to confirm uninstall: ${C.reset}`)
  if (ans.trim().toLowerCase() !== 'yes') { console.log(`  ${C.dim}Cancelled.${C.reset}`); await ask(`${C.dim}Press Enter to continue...${C.reset}`); return }
  console.log('')
  console.log(`  ${C.cyan}Uninstalling packages...${C.reset}`)
  npm(['uninstall', '-g', '@xurxuo/claude-code-termux', '@anthropic-ai/claude-code-linux-arm64'])
  try { fs.unlinkSync('/data/data/com.termux/files/usr/bin/claude') } catch {}
  console.log('')
  console.log(`  ${C.green}✓ Uninstall complete!${C.reset}`)
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerOpenDocs() {
  console.clear()
  console.log(header('📖 OPEN DOCUMENTATION'))
  console.log('')
  console.log('  Opening GitHub repo in browser...')
  spawnSync('am', ['start', 'https://github.com/DamnSit/claude-code-termux'], { stdio: 'ignore' })
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerAbout() {
  console.clear()
  console.log(header('ℹ️  ABOUT'))
  console.log('')
  let wrapperVer = 'unknown'; try { wrapperVer = require('/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/package.json').version } catch {}
  let nativeVer = 'unknown'; try { nativeVer = require('/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/package.json').version } catch {}
  console.log(`  ${C.bold}@xurxuo/claude-code-termux${C.reset} v${wrapperVer}`)
  console.log(`  ${C.dim}Claude Code native binary${C.reset}  v${nativeVer}`)
  console.log('')
  console.log(`  ${C.dim}Run Claude Code natively on Android ARM64 with Termux.${C.reset}`)
  console.log(`  ${C.dim}No Ubuntu, proot, cloud VM, or desktop needed.${C.reset}`)
  console.log('')
  console.log(`  ${C.dim}Maintainer:${C.reset} t.me/XurXuo`)
  console.log(`  ${C.dim}GitHub:${C.reset} github.com/DamnSit/claude-code-termux`)
  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

const MANAGER_ITEMS = [
  { label: 'View Status',       icon: '📊', fn: managerStatus },
  { label: 'Check Updates',     icon: '🔍', fn: managerCheckUpdates },
  { label: 'Update Packages',   icon: '⬆️', fn: managerUpdatePackages },
  { label: 'Manage API Key',    icon: '🔑', fn: managerApiKey },
  { label: 'Reinstall',         icon: '🔄', fn: managerReinstall },
  { label: 'Uninstall',         icon: '🗑️', fn: managerUninstall },
  { label: 'Open Docs',         icon: '📖', fn: managerOpenDocs },
  { label: 'About',             icon: 'ℹ️', fn: managerAbout },
]

async function runManager() {
  process.stdout.write('\x1b[?1049h')
  let choice = ''
  try {
    while (choice !== '0') {
      console.clear()
      console.log(header('MANAGER'))
      console.log('')
      console.log(`  ${C.dim}Select an option:${C.reset}`)
      console.log('')
      for (let i = 0; i < MANAGER_ITEMS.length; i++) {
        console.log(`  ${C.cyan}${String(i + 1).padStart(2)}.${C.reset} ${MANAGER_ITEMS[i].icon} ${MANAGER_ITEMS[i].label}`)
      }
      console.log('')
      console.log(`  ${C.red} 0. Exit${C.reset}`)
      console.log('')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      choice = await new Promise((res) => { rl.question(`${C.cyan}> ${C.reset}`, (ans) => { rl.close(); res(ans.trim()) }) })
      const idx = parseInt(choice, 10) - 1
      if (idx >= 0 && idx < MANAGER_ITEMS.length) {
        console.clear()
        try { await MANAGER_ITEMS[idx].fn() } catch (e) {
          console.error(`${C.red}Error: ${e.message}${C.reset}`)
          await ask(`${C.dim}Press Enter to continue...${C.reset}`)
        }
      } else if (choice !== '0') {
        await ask(`${C.yellow}Invalid option. Press Enter...${C.reset}`)
      }
    }
  } finally {
    process.stdout.write('\x1b[?1049l')
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const forceUpdate = args[0] === 'update' || args[0] === '--update' || args[0] === '-update'


  if (forceUpdate) {
    runUpdate()
    process.exit(0)
  }

  if (args[0] === 'manager') {
    await runManager()
    process.exit(0)
  }

  const binaryPath = getBinaryPath()
  const result = runNative(binaryPath, args)
  if (result.error && result.error.code === 'ENOENT') {
    const retryPath = getBinaryPath({ forceUpdate: true })
    const retry = runNative(retryPath, args)
    if (!retry.error) {
      if (retry.signal) { process.exit(128 + (constants.signals[retry.signal] ?? 0)) }
      process.exit(retry.status ?? 1)
    }
  }
  if (result.error) {
    console.error(`[${WRAPPER_NAME}] Failed to execute native binary at ` + binaryPath)
    console.error('  ' + result.error.message)
    process.exit(1)
  }
  if (result.signal) { process.exit(128 + (constants.signals[result.signal] ?? 0)) }
  else { process.exit(result.status ?? 1) }
}

main().catch((e) => { console.error(`[${WRAPPER_NAME}] Fatal: ${e.message}`); process.exit(1) })

  if (!_grunInstallTried) {
    _grunInstallTried = true
    console.error(`[${WRAPPER_NAME}] grun (glibc-runner) not found — installing once...`)
    spawnSync('pkg', ['install', 'glibc-repo', '-y'], { stdio: 'inherit' })
    spawnSync('pkg', ['update', '-y'], { stdio: 'inherit' })
    spawnSync('pkg', ['install', 'glibc-runner', '-y'], { stdio: 'inherit' })
    g = resolveGrun()
    if (!g) {
      console.error(`[${WRAPPER_NAME}] grun still missing — repairing glibc-runner...`)
      spawnSync('pkg', ['install', '--reinstall', 'glibc-runner', '-y'], { stdio: 'inherit' })
      g = resolveGrun()
    }
    if (g) console.error(`[${WRAPPER_NAME}] ✓ grun ready: ${g}`)
  }
  _grunPath = g
  return g
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

function npmGlobalRoot() {
  const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr'
  return path.join(PREFIX, 'lib', 'node_modules')
}

function installedVersion(pkg) {
  try {
    return require(path.join(npmGlobalRoot(), pkg, 'package.json')).version
  } catch {
    return null
  }
}

// If npm leaves cli-wrapper.cjs truncated/corrupt after an install (a known
// npm/mirror quirk on some Termux setups), restore it from GitHub so an update
// can never brick the launcher again.
function selfHealWrapper() {
  try {
    const wrapperPath = path.join(npmGlobalRoot(), WRAPPER_NAME, 'cli-wrapper.cjs')
    let content = ''
    try { content = fs.readFileSync(wrapperPath, 'utf8') } catch {}
    const intact = content.split('\n').length >= 50 && content.includes('runNative')
    if (intact) return true
    console.error(`[${WRAPPER_NAME}] Installed wrapper looks corrupt \u2014 restoring from GitHub...`)
    const url = 'https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/npm-package/package/cli-wrapper.cjs'
    const r = spawnSync('curl', ['-fsSL', url, '-o', wrapperPath], { stdio: 'inherit' })
    const ok = r.status === 0
    console.error(`[${WRAPPER_NAME}] ${ok ? '\u2713 wrapper restored from GitHub' : '\u26a0 could not restore wrapper (check network)'}`)
    return ok
  } catch {
    return false
  }
}

// `claude update` \u2014 bring BOTH the wrapper and the native Claude Code binary
// to their latest versions, then self-heal the wrapper file if needed.
function runUpdate() {
  const info = PLATFORMS[getPlatformKey()]
  const nativePkg = info ? info.pkg : null

  console.error(`[${WRAPPER_NAME}] Updating Claude Code to latest...`)

  const wBefore = installedVersion(WRAPPER_NAME)
  console.error(`[${WRAPPER_NAME}] \u2192 wrapper ${WRAPPER_NAME} (current ${wBefore || 'unknown'})`)
  npmInstallLatest([WRAPPER_NAME])
  selfHealWrapper()

  if (nativePkg) {
    const nBefore = installedVersion(nativePkg)
    console.error(`[${WRAPPER_NAME}] \u2192 native ${nativePkg} (current ${nBefore || 'unknown'})`)
    npmInstallLatest([nativePkg])
  }

  markUpdateChecked()

  const wAfter = installedVersion(WRAPPER_NAME)
  const nAfter = nativePkg ? installedVersion(nativePkg) : null
  console.error('')
  console.error(`[${WRAPPER_NAME}] \u2713 Update complete`)
  console.error(`[${WRAPPER_NAME}]   wrapper: ${wAfter || 'unknown'}`)
  console.error(`[${WRAPPER_NAME}]   native:  ${nAfter || 'unknown'}`)
  console.error(`[${WRAPPER_NAME}]   (wrapper changes apply on next \`claude\` launch)`)
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
    // Run grun via PATH first — exactly what worked in 2.1.146. No `which`
    // gatekeeping: some Termux setups lack the `which` binary, which made the
    // old detection fail even though `grun` ran fine. Only if grun is genuinely
    // missing (ENOENT) do we self-heal once, then retry with a resolved path.
    let r = spawnSync('grun', [binaryPath, ...args], { stdio: 'inherit', env })
    if (r.error && r.error.code === 'ENOENT') {
      const grun = ensureGrun()
      if (!grun) {
        console.error(`[${WRAPPER_NAME}] ERROR: grun (glibc-runner) not found.`)
        console.error(`[${WRAPPER_NAME}]   Fix: pkg install glibc-repo && pkg update && pkg install --reinstall glibc-runner`)
        process.exit(1)
      }
      r = spawnSync(grun, [binaryPath, ...args], { stdio: 'inherit', env })
    }
    return r
  }
  return spawnSync(binaryPath, args, { stdio: 'inherit', env })
}

// ─── Manager TUI ──────────────────────────────────────────────────────────────

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', white: '\x1b[37m' }
const WIDTH = 50

function header(title) {
  const pad = Math.max(0, Math.floor((WIDTH - title.length - 2) / 2))
  return `${C.cyan}${C.bold}${'═'.repeat(WIDTH)}${C.reset}\n${C.cyan}║${' '.repeat(pad)}${C.reset}${C.white}${C.bold}${title}${C.reset}${C.cyan}${' '.repeat(WIDTH - pad - title.length - 2)}║${C.reset}\n${C.cyan}${C.bold}${'═'.repeat(WIDTH)}${C.reset}`
}

function bar(label, value, color) {
  const c = C[color] || C.white
  const maxVal = WIDTH - label.length - value.length - 8
  const barLen = Math.min(maxVal, Math.max(0, maxVal))
  return `  ${c}${label}:${C.reset} ${value} ${c}${'█'.repeat(barLen)}${C.reset}`
}

function spawnOutput(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false, ...opts })
  return { stdout: r.stdout || '', stderr: r.stderr || '', code: r.status || 0 }
}

function npm(args, silent = false) {
  const cmd = process.env.npm_execpath ? process.execPath : 'npm'
  const a = process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args
  const opts = silent ? { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' } : { stdio: 'inherit' }
  return spawnSync(cmd, a, opts)
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => { rl.question(question, (ans) => { rl.close(); res(ans) }) })
}

function npmViewPkg(pkg) {
  const r = spawnOutput('npm', ['view', pkg, 'version', '--silent'])
  return r.code === 0 ? r.stdout.trim() : null
}

function appendToBashrc(line) {
  try {
    const rc = path.join(os.homedir(), '.bashrc')
    const content = fs.readFileSync(rc, 'utf8')
    const filtered = content.split('\n').filter(l => !/^export\s+ANTHROPIC_API_KEY=/.test(l)).join('\n')
    fs.writeFileSync(rc, filtered + '\n' + line + '\n')
  } catch (e) {
    console.error(`  ${C.red}Failed to write .bashrc: ${e.message}${C.reset}`)
  }
}

// ─── Manager action functions ─────────────────────────────────────────────────

async function managerStatus() {
  console.clear()
  console.log(header('📊 STATUS'))
  console.log('')

  let wrapperVer = 'unknown'
  try { wrapperVer = require('/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/package.json').version } catch {}
  let nativeVer = 'unknown'
  try { nativeVer = require('/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/package.json').version } catch {}

  console.log(bar('Wrapper', `@xurxuo/claude-code-termux v${wrapperVer}`, 'cyan'))
  console.log(bar('Claude Binary', `v${nativeVer}`, 'cyan'))

  const latestWrapper = npmViewPkg('@xurxuo/claude-code-termux')
  const latestNative = npmViewPkg('@anthropic-ai/claude-code-linux-arm64')
  console.log(bar('Latest Wrapper', latestWrapper ? `v${latestWrapper}` : 'unavailable', latestWrapper && latestWrapper !== wrapperVer ? 'yellow' : 'green'))
  console.log(bar('Latest Native', latestNative ? `v${latestNative}` : 'unavailable', latestNative && latestNative !== nativeVer ? 'yellow' : 'green'))

  let lastCheck = 'never'
  try {
    const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.cache/claude-code-termux/update-check.json'), 'utf8'))
    if (state.lastChecked) lastCheck = new Date(Number(state.lastChecked)).toLocaleString()
  } catch {}
  console.log(bar('Last Update Check', lastCheck, 'dim'))

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || ''
  const keyStatus = apiKey ? `${apiKey.slice(0, 9)}...` : `${C.yellow}not set${C.reset}`
  console.log(bar('API Key', keyStatus, apiKey ? 'green' : 'yellow'))

  const grun = resolveGrun() || ''
  console.log(bar('glibc-runner (grun)', grun ? `✓ ${grun}` : `${C.red}✗ not found${C.reset}`, grun ? 'green' : 'red'))

  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerCheckUpdates() {
  console.clear()
  console.log(header('🔍 CHECK UPDATES'))
  console.log('')

  const wrapperCurr = (() => { try { return require('/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/package.json').version } catch { return null } })()
  const nativeCurr = (() => { try { return require('/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/package.json').version } catch { return null } })()
  const latestWrapper = npmViewPkg('@xurxuo/claude-code-termux')
  const latestNative = npmViewPkg('@anthropic-ai/claude-code-linux-arm64')

  const items = [
    ['Wrapper (@xurxuo/claude-code-termux)', wrapperCurr, latestWrapper],
    ['Native (@anthropic-ai/claude-code-linux-arm64)', nativeCurr, latestNative],
  ]

  let hasUpdate = false
  for (const [name, curr, latest] of items) {
    if (!latest) console.log(`  ${C.red}✗${C.reset} ${name}: ${C.red}Could not fetch${C.reset}`)
    else if (!curr) { console.log(`  ${C.yellow}○${C.reset} ${name}: ${C.yellow}not installed${C.reset} → latest: v${latest}`); hasUpdate = true }
    else if (curr !== latest) { console.log(`  ${C.yellow}↑${C.reset} ${name}: v${curr} → ${C.green}v${latest}${C.reset} ${C.green}(update available)${C.reset}`); hasUpdate = true }
    else console.log(`  ${C.green}✓${C.reset} ${name}: v${curr} ${C.green}(up to date)${C.reset}`)
  }

  console.log('')
  if (hasUpdate) console.log(`  ${C.yellow}Updates available! Run "Update Packages" to upgrade.${C.reset}`)
  else console.log(`  ${C.green}All packages are up to date.${C.reset}`)

  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerUpdatePackages() {
  console.clear()
  console.log(header('⬆️ UPDATE PACKAGES'))
  console.log('')
  console.log(`  ${C.cyan}Updating @xurxuo/claude-code-termux...${C.reset}`)
  const r1 = npm(['install', '-g', '--force', '@xurxuo/claude-code-termux@latest'])
  console.log(`  ${r1.status === 0 ? C.green + '✓' : C.red + '✗'} Wrapper ${r1.status === 0 ? 'updated' : 'update failed'}${C.reset}`)
  selfHealWrapper()
  console.log('')
  console.log(`  ${C.cyan}Updating @anthropic-ai/claude-code-linux-arm64...${C.reset}`)
  const r2 = npm(['install', '-g', '--force', '@anthropic-ai/claude-code-linux-arm64@latest'])
  console.log(`  ${r2.status === 0 ? C.green + '✓' : C.red + '✗'} Native ${r2.status === 0 ? 'updated' : 'update failed'}${C.reset}`)
  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerApiKey() {
  console.clear()
  console.log(header('🔑 MANAGE API KEY'))
  console.log('')

  const envKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || ''
  let bashrcKey = ''
  try {
    const lines = fs.readFileSync(path.join(os.homedir(), '.bashrc'), 'utf8').split('\n')
    for (const l of lines) {
      const m = l.match(/^export\s+ANTHROPIC_API_KEY=(.+)/)
      if (m) { bashrcKey = m[1].replace(/^['"]|['"]$/g, ''); break }
    }
  } catch {}

  const key = envKey || bashrcKey
  if (key) {
    console.log(`  Current key: ${C.green}${key.slice(0, 9)}...${C.reset}`)
    console.log('')
    const ans = await ask(`  ${C.yellow}Enter new API key (or press Enter to skip): ${C.reset}`)
    if (ans.trim()) { appendToBashrc(`export ANTHROPIC_API_KEY=${ans.trim()}`); console.log(`  ${C.green}✓ API key saved to ~/.bashrc${C.reset}`) }
    else console.log(`  ${C.dim}No changes made.${C.reset}`)
  } else {
    console.log(`  ${C.yellow}No API key found.${C.reset}`)
    console.log('')
    const ans = await ask(`  ${C.cyan}Enter your API key: ${C.reset}`)
    if (ans.trim()) { appendToBashrc(`export ANTHROPIC_API_KEY=${ans.trim()}`); console.log(`  ${C.green}✓ API key saved to ~/.bashrc${C.reset}`) }
  }
  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerReinstall() {
  console.clear()
  console.log(header('🔄 REINSTALL'))
  console.log('')
  const ans = await ask(`  ${C.yellow}This will remove and reinstall both packages. Continue? (type 'yes'): ${C.reset}`)
  if (ans.trim().toLowerCase() !== 'yes') { console.log(`  ${C.dim}Cancelled.${C.reset}`); await ask(`${C.dim}Press Enter to continue...${C.reset}`); return }
  console.log('')
  console.log(`  ${C.cyan}Uninstalling...${C.reset}`)
  npm(['uninstall', '-g', '@xurxuo/claude-code-termux', '@anthropic-ai/claude-code-linux-arm64'])
  console.log('')
  console.log(`  ${C.cyan}Installing...${C.reset}`)
  npm(['install', '-g', '--force', '@xurxuo/claude-code-termux@latest'])
  console.log('')
  console.log(`  ${C.green}✓ Reinstall complete!${C.reset}`)
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerUninstall() {
  console.clear()
  console.log(header('🗑️  UNINSTALL'))
  console.log('')
  const ans = await ask(`  ${C.red}Type 'yes' to confirm uninstall: ${C.reset}`)
  if (ans.trim().toLowerCase() !== 'yes') { console.log(`  ${C.dim}Cancelled.${C.reset}`); await ask(`${C.dim}Press Enter to continue...${C.reset}`); return }
  console.log('')
  console.log(`  ${C.cyan}Uninstalling packages...${C.reset}`)
  npm(['uninstall', '-g', '@xurxuo/claude-code-termux', '@anthropic-ai/claude-code-linux-arm64'])
  try { fs.unlinkSync('/data/data/com.termux/files/usr/bin/claude') } catch {}
  console.log('')
  console.log(`  ${C.green}✓ Uninstall complete!${C.reset}`)
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerOpenDocs() {
  console.clear()
  console.log(header('📖 OPEN DOCUMENTATION'))
  console.log('')
  console.log('  Opening GitHub repo in browser...')
  spawnSync('am', ['start', 'https://github.com/DamnSit/claude-code-termux'], { stdio: 'ignore' })
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

async function managerAbout() {
  console.clear()
  console.log(header('ℹ️  ABOUT'))
  console.log('')
  let wrapperVer = 'unknown'; try { wrapperVer = require('/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/package.json').version } catch {}
  let nativeVer = 'unknown'; try { nativeVer = require('/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/package.json').version } catch {}
  console.log(`  ${C.bold}@xurxuo/claude-code-termux${C.reset} v${wrapperVer}`)
  console.log(`  ${C.dim}Claude Code native binary${C.reset}  v${nativeVer}`)
  console.log('')
  console.log(`  ${C.dim}Run Claude Code natively on Android ARM64 with Termux.${C.reset}`)
  console.log(`  ${C.dim}No Ubuntu, proot, cloud VM, or desktop needed.${C.reset}`)
  console.log('')
  console.log(`  ${C.dim}Maintainer:${C.reset} t.me/XurXuo`)
  console.log(`  ${C.dim}GitHub:${C.reset} github.com/DamnSit/claude-code-termux`)
  console.log('')
  await ask(`${C.dim}Press Enter to continue...${C.reset}`)
}

const MANAGER_ITEMS = [
  { label: 'View Status',       icon: '📊', fn: managerStatus },
  { label: 'Check Updates',     icon: '🔍', fn: managerCheckUpdates },
  { label: 'Update Packages',   icon: '⬆️', fn: managerUpdatePackages },
  { label: 'Manage API Key',    icon: '🔑', fn: managerApiKey },
  { label: 'Reinstall',         icon: '🔄', fn: managerReinstall },
  { label: 'Uninstall',         icon: '🗑️', fn: managerUninstall },
  { label: 'Open Docs',         icon: '📖', fn: managerOpenDocs },
  { label: 'About',             icon: 'ℹ️', fn: managerAbout },
]

async function runManager() {
  process.stdout.write('\x1b[?1049h')
  let choice = ''
  try {
    while (choice !== '0') {
      console.clear()
      console.log(header('MANAGER'))
      console.log('')
      console.log(`  ${C.dim}Select an option:${C.reset}`)
      console.log('')
      for (let i = 0; i < MANAGER_ITEMS.length; i++) {
        console.log(`  ${C.cyan}${String(i + 1).padStart(2)}.${C.reset} ${MANAGER_ITEMS[i].icon} ${MANAGER_ITEMS[i].label}`)
      }
      console.log('')
      console.log(`  ${C.red} 0. Exit${C.reset}`)
      console.log('')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      choice = await new Promise((res) => { rl.question(`${C.cyan}> ${C.reset}`, (ans) => { rl.close(); res(ans.trim()) }) })
      const idx = parseInt(choice, 10) - 1
      if (idx >= 0 && idx < MANAGER_ITEMS.length) {
        console.clear()
        try { await MANAGER_ITEMS[idx].fn() } catch (e) {
          console.error(`${C.red}Error: ${e.message}${C.reset}`)
          await ask(`${C.dim}Press Enter to continue...${C.reset}`)
        }
      } else if (choice !== '0') {
        await ask(`${C.yellow}Invalid option. Press Enter...${C.reset}`)
      }
    }
  } finally {
    process.stdout.write('\x1b[?1049l')
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const forceUpdate = args[0] === 'update' || args[0] === '--update' || args[0] === '-update'


  if (forceUpdate) {
    runUpdate()
    process.exit(0)
  }

  if (args[0] === 'manager') {
    await runManager()
    process.exit(0)
  }

  const binaryPath = getBinaryPath()
  const result = runNative(binaryPath, args)
  if (result.error && result.error.code === 'ENOENT') {
    const retryPath = getBinaryPath({ forceUpdate: true })
    const retry = runNative(retryPath, args)
    if (!retry.error) {
      if (retry.signal) { process.exit(128 + (constants.signals[retry.signal] ?? 0)) }
      process.exit(retry.status ?? 1)
    }
  }
  if (result.error) {
    console.error(`[${WRAPPER_NAME}] Failed to execute native binary at ` + binaryPath)
    console.error('  ' + result.error.message)
    process.exit(1)
  }
  if (result.signal) { process.exit(128 + (constants.signals[result.signal] ?? 0)) }
  else { process.exit(result.status ?? 1) }
}

main().catch((e) => { console.error(`[${WRAPPER_NAME}] Fatal: ${e.message}`); process.exit(1) })
