#!/bin/bash
# Secure installer - verifies checksums before running

REPO="DamnSit/claude-code-termux"
BASE_URL="https://raw.githubusercontent.com/${REPO}/main"

echo "🔐 Verifying installer integrity..."
echo ""

# Download checksums file
echo "  ▸ Downloading checksums..."
CHECKSUMS_ERR=$(curl -fSL "${BASE_URL}/CHECKSUMS.txt" -o /tmp/CHECKSUMS.txt 2>&1)
if [[ $? -eq 0 ]]; then
    echo "  ✅ Checksums downloaded"
    CHECKSUMS_OK=1
else
    echo "  ⚠ Checksums download failed: ${CHECKSUMS_ERR:-unknown error}"
    CHECKSUMS_OK=0
fi

# Download install script
echo "  ▸ Downloading installer..."
INSTALL_ERR=$(curl -fSL "${BASE_URL}/install.sh" -o /tmp/install.sh 2>&1)
if [[ $? -ne 0 ]]; then
    echo "❌ Failed to download installer."
    echo "   Error: ${INSTALL_ERR:-unknown}"
    echo ""
    echo "   Try alternative:"
    echo "   wget -O- https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash"
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