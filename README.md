# Claude Code Termux

**Claude Code native on Android ARM64 — no Ubuntu, no proot-distro.**

Automatic installer that handles all setup: deps, binary, platform patch, glibc-runner, API key, and model selection — one command done.

---

## Install - Shell Version (Recommended)

**Cukup satu perintah:**
```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

Installer akan meminta:
1. API key Anthropic
2. Model (sonnet/haiku)
3. Optional: custom base URL

**Setelah install:**
```bash
source ~/.bashrc
claude
```

---

## Install - Rust Version

**1 baris di Termux:**
```bash
curl -fsSL https://github.com/DamnSit/claude-code-termux/releases/latest/download/claude-termux -o $PREFIX/bin/claude && chmod +x $PREFIX/bin/claude
```

**Jalankan:**
```bash
claude
```

Binary akan auto-install dependencies kalau belum ada!

**Build sendiri:**
```bash
git clone https://github.com/DamnSit/claude-code-termux
cd claude-code-termux/rust-wrapper
cargo build --release --target aarch64-unknown-linux-gnu
```

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

## What's installed (Shell version)

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

**Rust version perlu install manual:**
```bash
pkg install nodejs-lts grun
npm install -g @anthropic-ai/claude-code @anthropic-ai/claude-code-linux-arm64
```

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

**Shell version:**
```bash
claude -u
# atau
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

**Rust version:**
Perlu rebuild dari source atau download binary baru dari release.

---

## Uninstall

**Shell version:**
```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | bash
```

**Rust version:**
```bash
rm /data/data/com.termux/files/usr/bin/claude
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
| Cara Install | `curl -fsSL ... \| bash` | Download release / build sendiri |
| Binary Claude | Sudah termasuk | Perlu `npm install` manual |
| Update | `claude -u` | Rebuild / download ulang |
| Customize | Edit langsung script | Edit code + rebuild |
| Ukuran | ~200 baris | ~1.1 MB |

**Pilih yang mana?**
- **Shell** - Lebih mudah, tinggal jalankan installer
- **Rust** - Lebih performant, tapi butuh setup manual

---

*Native binary. Native performance.*