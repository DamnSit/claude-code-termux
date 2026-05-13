# Claude Code Termux

**Claude Code native on Android ARM64 — no Ubuntu, no proot-distro.**

Automatic installer that handles all setup: deps, binary, platform patch, glibc-runner, API key, and model selection — one command done.

---

## Install

**Shell version (recommended):**
```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

**Rust version (pre-built binary):**
```bash
# Download dari Releases: https://github.com/DamnSit/claude-code-termux/releases
# Copy ke Termux:
adb push claude-termux /data/data/com.termux/files/usr/bin/claude
chmod +x /data/data/com.termux/files/usr/bin/claude
```

**Rust version (build from source):**
```bash
# 1. Clone repo
# 2. cd rust-wrapper
# 3. cargo build --release --target aarch64-unknown-linux-gnu
# 4. Copy binary ke Termux: /data/data/com.termux/files/usr/bin/claude
```

Lihat [rust-wrapper/BUILD.md](rust-wrapper/BUILD.md) untuk detail build.

After install:

```bash
source ~/.bashrc
claude
```

---

## Requirements

- Android ARM64 (aarch64)
- [Termux from F-Droid](https://f-droid.org/en/packages/com.termux/) — not Play Store
- Internet
- Anthropic API key → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

---

## How it works

```
claude (alias)
  └── grun                          ← glibc-runner (run glibc binary on Bionic)
        └── claude-code-linux-arm64 ← official Anthropic native binary
```

**Why this is different from other setups:**

| Other setups | This repo |
|---|---|
| Pinned to old version (v2.1.112) | Latest version |
| JS via `node cli.js` | Native ARM64 binary |
| proot-distro Ubuntu | `glibc-runner` directly |
| Slow startup | Native performance |

---

## What's installed

| Package | Purpose |
|---|---|
| `nodejs-lts` | Runtime + npm |
| `glibc-runner` | Run glibc binary on Android Bionic |
| `@anthropic-ai/claude-code` | Claude Code (JS layer) |
| `@anthropic-ai/claude-code-linux-arm64` | Native ARM64 binary |

**Auto-patched:**
- `cli-wrapper.cjs` — platform detection `android` → `linux`
- `install.cjs` — same

**Config:**
- `~/.claude/settings.json` — API key, model, base URL
- `~/.bashrc` + `~/.zshrc` — alias `claude`

---

## Custom endpoint

Installer will ask for base URL during setup. Example for using other providers:

```
Base URL: https://opencode.ai/zen
```

Or edit directly `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://opencode.ai/zen",
    "ANTHROPIC_MODEL": "claude-sonnet-4-5",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  },
  "autoUpdatesChannel": "latest"
}
```

---

## Update

Two ways:

```bash
# Method 1: CLI (recommended)
claude -u

# Method 2: Re-run installer
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

---

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | bash
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Tested

| Device | Android | Arch | Node | Status |
|---|---|---|---|---|
| ARM64 | 16 | aarch64 | LTS | ✅ |

---

---

## Shell vs Rust Version

| Feature | Shell | Rust |
|---------|-------|------|
| Install | `curl -fsSL ... \| bash` | Download release |
| Dependencies | bash, curl | None (static binary) |
| Customize | Easy (edit script) | Rebuild required |
| Error handling | Basic | Robust (Result type) |
| Size | ~200 lines | ~1.1 MB |

**Recommended:** Shell version for most users. Rust version for those who prefer a single static binary.

---

*Native binary. Native performance.*