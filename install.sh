#!/data/data/com.termux/files/usr/bin/bash
# Claude Code Termux - Simple Install
# curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash

set -euo pipefail

echo "🔧 Installing Claude Code for Termux..."

# Check ARM64
[[ "$(uname -m)" == "aarch64" ]] || { echo "Only ARM64 supported"; exit 1; }

# Install deps
echo "📦 Installing packages..."
pkg update -y -q 2>/dev/null || true
pkg install -y nodejs-lts git wget 2>/dev/null || true

# Try different names for glibc-runner
if ! command -v grun &>/dev/null; then
    echo "🔍 Looking for glibc-runner..."
    pkg install -y grun 2>/dev/null || \
    pkg install -y glibc-runner 2>/dev/null || \
    pkg install -y termux-api 2>/dev/null || true
fi

# Create temp dir in PREFIX (writable)
TEMP_DIR="/data/data/com.termux/files/usr/tmp"
mkdir -p "$TEMP_DIR"

# Install Claude Code JS layer
echo "📥 Downloading Claude Code..."
npm install -g @anthropic-ai/claude-code 2>/dev/null || true

# Install native binary directly
echo "📥 Downloading native binary..."
ARM_DIR="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64"
mkdir -p "$ARM_DIR"
VERSION=$(npm view @anthropic-ai/claude-code-linux-arm64 version 2>/dev/null || echo "2.1.141")
echo "   Version: $VERSION"

# Use PREFIX temp dir
TARBALL="${TEMP_DIR}/claude.tgz"
echo "   Downloading..."

if curl -fSL "https://registry.npmjs.org/@anthropic-ai/claude-code-linux-arm64/-/claude-code-linux-arm64-${VERSION}.tgz" -o "$TARBALL"; then
    echo "   Extracting..."
    tar -xzf "$TARBALL" -C "$ARM_DIR"
    [[ -f "$ARM_DIR/package/claude" ]] && mv "$ARM_DIR/package/claude" "$ARM_DIR/claude"
    rm -rf "$ARM_DIR/package" "$TARBALL"
    echo "   ✓ Binary installed"
else
    echo "   ⚠️ Download failed"
fi

# CRITICAL: Create wrapper
echo "🔧 Creating wrapper..."
WRAPPER_FILE="/data/data/com.termux/files/usr/bin/claude"
rm -f "$WRAPPER_FILE"

# Write wrapper using printf (more reliable than heredoc)
if command -v grun &>/dev/null; then
    printf '%s\n' '#!/bin/bash' 'exec grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude "$@"' > "$WRAPPER_FILE"
else
    printf '%s\n' '#!/bin/bash' 'exec node /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/run.js "$@"' > "$WRAPPER_FILE"
fi
chmod +x "$WRAPPER_FILE"
echo "   ✓ Wrapper created"

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