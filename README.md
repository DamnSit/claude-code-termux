# Claude Code Termux

**Claude Code native di Android ARM64 — tanpa Ubuntu, tanpa proot-distro.**

Installer otomatis yang handle semua setup: deps, binary, platform patch, glibc-runner, API key, dan model selection — satu command selesai.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

Setelah install:

```bash
source ~/.bashrc
claude
```

---

## Requirements

- Android ARM64 (aarch64)
- [Termux dari F-Droid](https://f-droid.org/en/packages/com.termux/) — bukan Play Store
- Internet
- Anthropic API key → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

---

## Cara kerja

```
claude (alias)
  └── grun                          ← glibc-runner (jalanin glibc binary di Bionic)
        └── claude-code-linux-arm64 ← official Anthropic native binary
```

**Kenapa ini beda dari setup lain:**

| Setup lain | Repo ini |
|---|---|
| Pin ke versi lama (v2.1.112) | Latest version |
| JS via `node cli.js` | Native ARM64 binary |
| proot-distro Ubuntu | `glibc-runner` langsung |
| Lambat startup | Native performance |

---

## Yang di-install

| Package | Fungsi |
|---|---|
| `nodejs-lts` | Runtime + npm |
| `glibc-runner` | Jalanin binary glibc di Android Bionic |
| `@anthropic-ai/claude-code` | Claude Code (JS layer) |
| `@anthropic-ai/claude-code-linux-arm64` | Native ARM64 binary |

**Patch otomatis:**
- `cli-wrapper.cjs` — deteksi platform `android` → `linux`
- `install.cjs` — sama

**Config:**
- `~/.claude/settings.json` — API key, model, base URL
- `~/.bashrc` + `~/.zshrc` — alias `claude`

---

## Custom endpoint

Installer akan nanya base URL saat setup. Contoh untuk pakai provider lain:

```
Base URL: https://opencode.ai/zen
```

Atau edit langsung `~/.claude/settings.json`:

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

Ada dua cara:

```bash
# Cara 1: CLI (rekomendasi)
claude -u

# Cara 2: Re-run installer
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

---

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | bash
```

---

## Troubleshooting

Lihat [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Tested

| Device | Android | Arch | Node | Status |
|---|---|---|---|---|
| ARM64 | 16 | aarch64 | LTS | ✅ |

---

*Native binary. Native performance.*
