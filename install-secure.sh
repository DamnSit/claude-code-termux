#!/bin/bash
# Secure installer - verifies checksums before running

set -euo pipefail

REPO="DamnSit/claude-code-termux"
BASE_URL="https://raw.githubusercontent.com/${REPO}/main"

echo "🔐 Verifying installer integrity..."
echo ""

# Download checksums file
echo "  ▸ Downloading checksums..."
if curl -fSL "${BASE_URL}/CHECKSUMS.txt" -o /tmp/CHECKSUMS.txt; then
    echo "  ✅ Checksums downloaded"
    CHECKSUMS_OK=1
else
    echo "  ⚠ Failed to download checksums (network issue?), skipping verification"
    CHECKSUMS_OK=0
fi

# Download install script
echo "  ▸ Downloading installer..."
if ! curl -fSL "${BASE_URL}/install.sh" -o /tmp/install.sh; then
    echo "❌ Failed to download installer."
    echo "   Try: wget -O- https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash"
    exit 1
fi
echo "  ✅ Installer downloaded"

# Verify checksums if available
if [[ "$CHECKSUMS_OK" -eq 1 ]]; then
    echo "  ▸ Verifying checksums..."
    if sha256sum -c /tmp/CHECKSUMS.txt --status 2>/dev/null; then
        echo "  ✅ Checksums verified!"
    else
        echo "  ⚠ Checksum mismatch - continuing anyway (manual verify recommended)"
    fi
fi

echo ""
echo "✅ Running installer..."
echo ""

# Execute installer
chmod +x /tmp/install.sh
bash /tmp/install.sh "$@"