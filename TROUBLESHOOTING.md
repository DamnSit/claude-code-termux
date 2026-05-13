# Troubleshooting

## `command not found: claude`

```bash
source ~/.bashrc
```

If it still fails:
```bash
alias claude="grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude"
```

---

## `grun: command not found`

```bash
pkg install glibc-repo -y
pkg update
pkg install glibc-runner -y
```

---

## `claude --version` exits with error / crash

Verify binary directly:
```bash
grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude --version
```

If it still crashes, re-run installer:
```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

---

## API key error / unauthorized

Check `~/.claude/settings.json`:
```bash
cat ~/.claude/settings.json
```

Edit if needed:
```bash
nano ~/.claude/settings.json
```

---

## Platform detection error

Patch may not have applied. Re-run installer to automatically re-patch. Or manually:

```bash
nano /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/cli-wrapper.cjs
```

Find: `const platform = process.platform`

Replace with:
```js
const platform =
  process.platform === 'android'
    ? 'linux'
    : process.platform
```

Do the same in `install.cjs`.

---

## After `pkg upgrade`, claude breaks

Upgrade can overwrite node_modules. Re-run installer.

---

## Slow / hang on first launch

Normal — glibc-runner needs first-time init. Wait ~5 seconds.