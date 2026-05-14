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

**Secure way** — verifies checksums before running:

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install-secure.sh | bash
```

**Standard way** — downloads and runs directly:

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

The installer will:
1. Install required packages (nodejs, grun)
2. Download Claude Code
3. Ask for your API key
4. Secure your settings file (permissions: 600)

---

## Verify Before Running (Recommended)

For extra security, verify the scripts first:

```bash
# 1. Download checksums
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/CHECKSUMS.txt -o CHECKSUMS.txt

# 2. Download scripts
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh -o install.sh

# 3. Verify checksums
sha256sum -c CHECKSUMS.txt

# 4. If verified, run installer
bash install.sh
```

---

## GPG Signature Verification (Most Secure)

All scripts are **cryptographically signed** with GPG. Verify the signature to ensure the scripts are authentic and from the author:

```bash
# 1. Import author's GPG public key
gpg --keyserver keyserver.ubuntu.com --search-keys dimarlin65@gmail.com
# Or import directly:
curl -fsSL https://github.com/DamnSit.gpg | gpg --import

# 2. Download script and signature
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh -o install.sh
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh.asc -o install.sh.asc

# 3. Verify signature
gpg --verify install.sh.asc install.sh

# 4. If "gpg: Good signature" appears, it's verified!
```

### Verify All Scripts at Once:
```bash
for script in install.sh install-secure.sh install-simple.sh claude-wrapper.sh uninstall.sh; do
    curl -fsSL "https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/$script" -o "$script"
    curl -fsSL "https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/$script.asc" -o "$script.asc"
    gpg --verify "$script.asc" "$script" && echo "✓ $script" || echo "✗ $script FAILED"
done
```

### GPG Key Info:
| Field | Value |
|-------|-------|
| **Key ID** | `63788A3CE203C94C` |
| **Fingerprint** | `6330DDFEF6C0B831A26699C863788A3CE203C94C` |
| **Email** | [Private] |
| **Owner** | DamnSit |

---

## Alternative: Install via NPM

```bash
pkg update && pkg install nodejs-lts
npm install -g @xurxuo/claude-code-termux
```

---

## Alternative: Use Shell Wrapper Only

If you just want the wrapper (no auto-install):

```bash
# Download and review the script first
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/claude-wrapper.sh -o /tmp/claude-wrapper.sh

# Read it - it's just bash, easy to audit!
cat /tmp/claude-wrapper.sh

# If OK, install it
mv /tmp/claude-wrapper.sh $PREFIX/bin/claude
chmod +x $PREFIX/bin/claude
```

---

## ⚠️ Avoid: Pre-compiled ELF Binary

The `claude-termux` binary is a compiled ELF that cannot be easily audited. Use the shell scripts instead.

---

## Get Your API Key

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Click "Create Key"
3. Copy the key
4. In Termux, run:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

Or add it to your settings (installer will ask):

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
| `claude --dangerously-skip-permissions` | Run without permission prompts (advanced) |

### About --dangerously-skip-permissions

This flag tells Claude Code to **skip all permission prompts** and run any tool/command automatically.

**⚠️ Risks (use with caution):**
- Can accidentally delete important files
- Can run harmful commands (like `rm -rf /`)
- No protection against mistakes

**Example:**
```bash
claude --dangerously-skip-permissions
```

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

## Security

### What we do to protect you:
- **GPG Signature Verification** — all scripts are cryptographically signed (see above)
- **Checksum verification** — SHA256 checksums available for integrity check
- **Secure file permissions** — settings.json protected with `chmod 600`
- **JSON injection prevention** — use `jq` for safe JSON building
- **No arbitrary code execution** — scripts only run documented commands

### What we DON'T do:
- Never download or run arbitrary code
- Never write outside intended directories
- Never execute hidden commands
- Never log your API key

### Audit the code yourself:
```bash
# Read all scripts
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | less
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/claude-wrapper.sh | less
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | less
```

---

## Need Help?

- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Open an issue on GitHub

---

*Built for Android. Built for developers.*
