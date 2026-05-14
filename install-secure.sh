#!/bin/bash
# Secure installer - verifies checksums before running

set -euo pipefail

REPO="DamnSit/claude-code-termux"
BASE_URL="https://raw.githubusercontent.com/${REPO}/main"

echo "🔐 Verifying installer integrity..."

# Download checksums
curl -fsSL "${BASE_URL}/CHECKSUMS.txt" -o /tmp/CHECKSUMS.txt

# Download scripts to temp
curl -fsSL "${BASE_URL}/install.sh" -o /tmp/install.sh

# Verify checksums
if ! sha256sum -c /tmp/CHECKSUMS.txt --status 2>/dev/null; then
    echo "❌ Checksum verification failed! Possible tampering detected."
    exit 1
fi

echo "✅ Checksums verified. Running installer..."
echo ""

# Execute installer
chmod +x /tmp/install.sh
bash /tmp/install.sh "$@"