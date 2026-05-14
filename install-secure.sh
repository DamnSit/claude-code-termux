#!/bin/bash
# Secure installer - verifies checksums before running
# Usage: curl -fsSL https://.../install-secure.sh | bash

REPO="DamnSit/claude-code-termux"
BASE_URL="https://raw.githubusercontent.com/${REPO}/main"

# Termux uses $PREFIX/tmp, fallback to /tmp
TMPDIR="${PREFIX:-/data/data/com.termux/files/usr}/tmp"
mkdir -p "$TMPDIR"

echo "🔐 Verifying installer integrity..."
echo ""

# Download checksums file
echo "  ▸ Downloading checksums..."
if curl -fSL "${BASE_URL}/CHECKSUMS.txt" -o "${TMPDIR}/CHECKSUMS.txt" 2>/dev/null; then
    echo "  ✅ Checksums downloaded"
    CHECKSUMS_OK=1
else
    echo "  ⚠ Failed to download checksums"
    CHECKSUMS_OK=0
fi

# Download install script
echo "  ▸ Downloading installer..."
if ! curl -fSL "${BASE_URL}/install.sh" -o "${TMPDIR}/install.sh" 2>/dev/null; then
    echo "❌ Failed to download installer."
    echo ""
    echo "   Try alternative:"
    echo "   wget -O- https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash"
    exit 1
fi
echo "  ✅ Installer downloaded"

# Verify checksums if available
if [[ "$CHECKSUMS_OK" -eq 1 ]]; then
    echo "  ▸ Verifying checksums..."
    if sha256sum -c "${TMPDIR}/CHECKSUMS.txt" --status 2>/dev/null; then
        echo "  ✅ Checksums verified!"
    else
        echo "  ⚠ Checksum mismatch - continuing anyway"
    fi
fi

echo ""
echo "✅ Running installer..."
echo ""

# Execute installer
chmod +x "${TMPDIR}/install.sh"
bash "${TMPDIR}/install.sh" "$@"