# Claude Code Termux

**Claude Code native on Android ARM64 — no Ubuntu, no proot-distro.**

---

## Install (Pilih salah satu)

### Option 1: Shell (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```
- Auto install semua dependencies
- Tanya API key saat install

### Option 2: NPM
```bash
pkg update && pkg install nodejs-lts
npm install -g @xurxuo/claude-code-termux
```
- Package dari npm dengan Termux patch

### Option 3: Rust Binary
```bash
curl -fsSL https://github.com/DamnSit/claude-code-termux/releases/latest/download/claude-termux -o $PREFIX/bin/claude && chmod +x $PREFIX/bin/claude
```
- Native binary, auto-install dependencies

---

## Usage

```bash
claude              # Start
claude --version    # Check version
claude -u           # Update (Shell version)
```

**Setup API key:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
atau edit `~/.claude/settings.json`

---

## Requirements

- Android ARM64 (aarch64)
- [Termux from F-Droid](https://f-droid.org/en/packages/com.termux/)
- Anthropic API key → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

---

## Versions

| Version | Install | Update |
|---------|---------|--------|
| Shell | `curl ... \| bash` | `claude -u` |
| NPM | `npm install -g @xurxuo/claude-code-termux` | `npm install -g @xurxuo/claude-code-termux` |
| Rust | Download dari releases | Download ulang |

---

## Update

```bash
# Shell version
claude -u

# NPM version
npm install -g @xurxuo/claude-code-termux

# Rust version
curl -fsSL https://github.com/DamnSit/claude-code-termux/releases/latest/download/claude-termux -o $PREFIX/bin/claude
```

---

## Uninstall

```bash
# Shell version
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | bash

# NPM version
npm uninstall -g @xurxuo/claude-code-termux

# Rust version
rm $PREFIX/bin/claude
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

*Native binary. Native performance.*