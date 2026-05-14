#!/data/data/com.termux/files/usr/bin/bash
# Simple install - just run this one command
# curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash

set -euo pipefail

echo "🔧 Installing Claude Code for Termux..."

# Check ARM64
[[ "$(uname -m)" == "aarch64" ]] || { echo "Only ARM64 supported"; exit 1; }

# Install deps - try multiple package names for glibc-runner
echo "📦 Installing packages..."
pkg update -y -q 2>/dev/null || true
pkg install -y nodejs-lts git wget 2>/dev/null || true

# Try different names for glibc-runner
if ! command -v grun &>/dev/null; then
    echo "🔍 Looking for glibc-runner..."
    pkg install -y grun 2>/dev/null || \
    pkg install -y glibc-runner 2>/dev/null || \
    pkg install -y termux-api 2>/dev/null || true

    # If grun still not found, try to install from npm
    if ! command -v grun &>/dev/null; then
        echo "⚠️ grun not found in repos, trying alternative..."
        # Maybe use node directly as fallback
    fi
fi

# Check if grun exists now
if ! command -v grun &>/dev/null; then
    echo ""
    echo "⚠️ WARNING: glibc-runner (grun) not installed."
    echo "   Some features may not work."
    echo "   Try: pkg install glibc"
fi

# Install Claude Code JS layer
echo "📥 Downloading Claude Code..."
npm install -g @anthropic-ai/claude-code 2>/dev/null || true

# Install native binary directly
echo "📥 Downloading native binary..."
ARM_DIR="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64"
mkdir -p "$ARM_DIR"
VERSION=$(npm view @anthropic-ai/claude-code-linux-arm64 version 2>/dev/null || echo "2.1.141")
curl -fsSL "https://registry.npmjs.org/@anthropic-ai/claude-code-linux-arm64/-/claude-code-linux-arm64-${VERSION}.tgz" -o /tmp/claude.tgz
tar -xzf /tmp/claude.tgz -C "$ARM_DIR"
mv "$ARM_DIR/package/claude" "$ARM_DIR/claude" 2>/dev/null || true
rm -rf "$ARM_DIR/package" /tmp/claude.tgz

# CRITICAL: Create wrapper that uses grun OR node
echo "🔧 Creating wrapper..."
if command -v grun &>/dev/null; then
    WRAPPER_CMD="exec grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude \"\$@\""
else
    # Use node as fallback - run JS wrapper
    WRAPPER_CMD="exec node /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/run.js \"\$@\""
fi

cat > /data/data/com.termux/files/usr/bin/claude << WRAPPER
#!/bin/bash
$WRAPPER_CMD
WRAPPER
chmod +x /data/data/com.termux/files/usr/bin/claude

# Backup npm wrapper to prevent overwrite
if [[ -f "/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe" ]]; then
    mv /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe.bak 2>/dev/null || true
fi

# Test
echo ""
echo "✅ Done!"
if command -v grun &>/dev/null; then
    echo "Testing native binary..."
    grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude --version 2>/dev/null || echo "Binary installed"
else
    echo "Testing with node..."
    node /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/run.js --version 2>/dev/null || echo "Installed"
fi

echo ""
echo "Usage: claude --version  (test)"
echo "       claude             (start)"
echo ""
echo "⚠️  Set API key: export ANTHROPIC_API_KEY=sk-ant-..."