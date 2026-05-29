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

# Install glibc repository first
pkg install -y glibc-repo 2>/dev/null || true
pkg update -y -q 2>/dev/null || true

# Install glibc-runner
if ! command -v grun &>/dev/null; then
    echo "🔍 Looking for glibc-runner..."
    pkg install -y grun 2>/dev/null || \
    pkg install -y glibc-runner 2>/dev/null || true
fi

# Verify grun exists
if ! command -v grun &>/dev/null; then
    echo ""
    echo "❌ glibc-runner (grun) not found"
    echo ""
    echo "Try manually:"
    echo "pkg install glibc-repo"
    echo "pkg update"
    echo "pkg install glibc-runner"
    exit 1
fi

# Create temp dir in PREFIX (writable)
TEMP_DIR="/data/data/com.termux/files/usr/tmp"
mkdir -p "$TEMP_DIR"
WORK_DIR="$(mktemp -d "${TEMP_DIR}/claude-install.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

# Install Claude Code JS layer
echo "📥 Downloading Claude Code..."
npm install -g @anthropic-ai/claude-code 2>/dev/null || true

# Install native binary directly
echo "📥 Downloading native binary..."
ARM_DIR="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64"
mkdir -p "$ARM_DIR"
VERSION=$(npm view @anthropic-ai/claude-code-linux-arm64 version 2>/dev/null || echo "2.1.141")
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2}(-[0-9A-Za-z.-]+)?$ ]] || { echo "Invalid package version: $VERSION"; exit 1; }
echo "   Version: $VERSION"

# Use PREFIX temp dir
TARBALL="${WORK_DIR}/claude.tgz"
EXTRACT_DIR="${WORK_DIR}/extract"
mkdir -p "$EXTRACT_DIR"
echo "   Downloading..."

if curl --proto '=https' --tlsv1.2 -fSL "https://registry.npmjs.org/@anthropic-ai/claude-code-linux-arm64/-/claude-code-linux-arm64-${VERSION}.tgz" -o "$TARBALL"; then
    echo "   Extracting..."
    while IFS= read -r entry; do
        case "$entry" in
            ""|/*|../*|*/../*|*"/.."|*"/../"*) echo "Unsafe tar entry: $entry"; exit 1 ;;
        esac
    done < <(tar -tzf "$TARBALL")
    tar -xzf "$TARBALL" -C "$EXTRACT_DIR"
    [[ -f "$EXTRACT_DIR/package/claude" ]] || { echo "   ❌ Claude binary missing from package"; exit 1; }
    install -m 0755 "$EXTRACT_DIR/package/claude" "$ARM_DIR/claude"
    echo "   ✓ Binary installed"
else
    echo "   ⚠️ Download failed"
fi

# CRITICAL: Create wrapper
echo "🔧 Creating wrapper..."
WRAPPER_FILE="/data/data/com.termux/files/usr/bin/claude"
rm -f "$WRAPPER_FILE"

# Write wrapper
printf '%s\n' \
'#!/bin/bash' \
'exec grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude "$@"' \
> "$WRAPPER_FILE"
chmod +x "$WRAPPER_FILE"
echo "   ✓ Wrapper created"

# Backup npm wrapper to prevent overwrite
if [[ -f "/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe" ]]; then
    mv /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe.bak 2>/dev/null || true
fi

# Test
echo ""
echo "✅ Done!"
echo "Testing native binary..."
grun /data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude --version || {
    echo ""
    echo "❌ Claude binary test failed"
    exit 1
}

echo ""
echo "Usage: claude --version  (test)"
echo "       claude             (start)"
echo ""
echo "⚠️  Set API key: export ANTHROPIC_API_KEY=sk-ant-..."rm -f "$WRAPPER_FILE"

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
