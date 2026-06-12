# Troubleshooting

## `claude` runs but prints nothing (silent, exit code 0)

The installed `cli-wrapper.cjs` got corrupted into a 2-line file that just
`require()`s itself (an infinite no-op). Older versions wrote a launcher to
`/usr/bin/claude`, which npm had symlinked to `cli-wrapper.cjs` — writing through
that symlink overwrote the real wrapper. Fixed in **2.1.176+**.

Recover an existing broken install:
```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/npm-package/package/cli-wrapper.cjs \
  -o /data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/cli-wrapper.cjs
claude --version
```
Verify it is the real file (line count should be > 50, and grep should print `1`):
```bash
wc -l /data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/cli-wrapper.cjs
grep -c ensureGrun /data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux/cli-wrapper.cjs
```

---

## npm `allow-scripts` warning (postinstall skipped)

If npm warns `allow-scripts ... (postinstall: node install.cjs)`, the postinstall is
skipped. That is fine on **2.1.176+** — `cli-wrapper.cjs` auto-installs `grun` on first
run (`ensureGrun`), so `claude` still works. To let postinstall run anyway:
```bash
npm install -g --allow-scripts=@xurxuo/claude-code-termux @xurxuo/claude-code-termux@latest
```

---


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

## `claude update` shows "Claude is managed by a package manager"

This was caused by shell installers using a bare bash wrapper that bypassed the npm wrapper's update handling. This is now fixed — both `install.sh` and `install-simple.sh` install the proper npm wrapper automatically.

If you still see this error on an older install:
```bash
npm install -g --force @xurxuo/claude-code-termux@latest
```

This reinstalls the wrapper with proper update handling. After this, `claude update` will work correctly.

---

## Slow / hang on first launch

Normal — glibc-runner needs first-time init. Wait ~5 seconds.