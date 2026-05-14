#!/bin/bash
# Secure installer - verifies checksums before running
# Usage: curl -fsSL https://.../install-secure.sh | bash
# Or:    curl -fsSL https://.../install-secure.sh -o install-secure.sh && bash install-secure.sh

set -euo pipefail

REPO="DamnSit/claude-code-termux"
BASE_URL="https://raw.githubusercontent.com/${REPO}/main"

echo "🔐 Verifying installer integrity..."
echo ""

# Download checksums file
echo "  ▸ Downloading checksums..."
if ! curl -fsSL --retry 3 --retry-delay 2 "${BASE_URL}/CHECKSUMS.txt" -o /tmp/CHECKSUMS.txt 2>/dev/null; then
    echo "  ⚠ Failed to download checksums, trying without verification..."
    DOWNLOAD_CHECKSUMS=0
else
    DOWNLOAD_CHECKSUMS=1
fi

# Download install script
echo "  ▸ Downloading installer..."
if ! curl -fsSL --retry 3 --retry-delay 2 "${BASE_URL}/install.sh" -o /tmp/install.sh 2>/dev/null; then
    echo "❌ Failed to download installer."
    exit 1
fi

# Verify checksums if available
if [[ "$DOWNLOAD_CHECKSUMS" -eq 1 ]]; then
    echo "  ▸ Verifying checksums..."
    if sha256sum -c /tmp/CHECKSUMS.txt --status 2>/dev/null; then
        echo "  ✅ Checksums verified!"
    else
        echo "  ⚠ Checksum mismatch - continuing anyway (manual verify recommended)"
    fi
else
    echo "  ⚠ Skipped checksum verification"
fi

echo ""
echo "✅ Running installer..."
echo ""

# Execute installer
chmod +x /tmp/install.sh
bash /tmp/install.sh "$@"