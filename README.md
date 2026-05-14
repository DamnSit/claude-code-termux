# Claude Code Termux

**Run Claude Code natively on Android — no Linux distro, no proot needed.**

---

## What is this?

Claude Code is an AI coding assistant. This project lets you run it on your Android phone using Termux — no computer needed!

### Requirements

- Android phone with ARM64 processor (most modern phones)
- [Termux app from F-Droid](https://f-droid.org/en/packages/com.termux/)
- [Anthropic API key](https://console.anthropic.com/settings/keys) (free to get)

---

## Quick Install (Recommended)

Copy and paste this in Termux:

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

That's it! The installer will:
1. Install required packages (nodejs, grun)
2. Download Claude Code
3. Ask for your API key

---

## Alternative: Install via NPM

If the quick install doesn't work, try this:

```bash
pkg update && pkg install nodejs-lts
npm install -g @xurxuo/claude-code-termux
```

---

## Alternative: Install Binary Directly

```bash
curl -fsSL https://github.com/DamnSit/claude-code-termux/releases/latest/download/claude-termux -o $PREFIX/bin/claude && chmod +x $PREFIX/bin/claude
```

---

## Get Your API Key

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Click "Create Key"
3. Copy the key
4. In Termux, run:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

Or add it to your settings:
```bash
nano ~/.claude/settings.json
```

Add:
```json
{
  "apiKey": "sk-ant-your-key-here"
}
```

---

## How to Use

| Command | What it does |
|---------|--------------|
| `claude` | Start Claude Code |
| `claude --version` | Check version |
| `claude update` | Update to latest version |
| `claude install` | Reinstall dependencies |
| `claude uninstall` | Remove Claude Code |

---

## First Time Setup

1. **Get API key** (see above)
2. **Run Claude:**
   ```bash
   claude
   ```
3. **Start coding!** Ask Claude to help you write code, debug, or learn programming.

---

## Update

```bash
claude update
```

Or reinstall:
```bash
npm install -g @xurxuo/claude-code-termux
```

---

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | bash
```

Or manually:
```bash
npm uninstall -g @xurxuo/claude-code-termux @anthropic-ai/claude-code @anthropic-ai/claude-code-linux-arm64
rm $PREFIX/bin/claude
```

**Note:** Your settings (`~/.claude/settings.json`) will be kept.

---

## Troubleshooting

### "npm error EBADPLATFORM"
This is normal on Android. The installer will download the binary directly.

### "API key not found"
Make sure you exported your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### "Permission denied"
Make sure the binary is executable:
```bash
chmod +x $PREFIX/bin/claude
```

---

## Need Help?

- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Open an issue on GitHub

---

*Built for Android. Built for developers.*