#!/data/data/com.termux/files/usr/bin/bash
# Claude Code Termux - Install Script
# curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${CYAN}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Claude Code for Termux  (ARM64)     ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ─── 1. Sanity checks ─────────────────────────────────────────────────────────
[[ "$(uname -m)" == "aarch64" ]] || die "Only ARM64 supported"
command -v pkg  &>/dev/null || die "pkg not found — run inside Termux"
command -v npm  &>/dev/null || true   # checked after install

# ─── 2. Core packages ─────────────────────────────────────────────────────────
info "Updating package lists..."
pkg update -y -q 2>/dev/null || true

info "Installing nodejs-lts, git, wget..."
pkg install -y nodejs-lts git wget 2>/dev/null || true

# ─── 3. glibc-runner — MUST come before any npm install ──────────────────────
info "Installing glibc-runner (grun)..."
pkg install -y glibc-repo 2>/dev/null || true
pkg update -y -q 2>/dev/null || true
pkg install -y grun 2>/dev/null || \
    pkg install -y glibc-runner 2>/dev/null || true

if ! command -v grun &>/dev/null; then
    die "glibc-runner (grun) not found after install.
    
Try manually:
  pkg install glibc-repo && pkg update && pkg install grun"
fi
ok "grun found at: $(command -v grun)"

# ─── 4. Install @xurxuo/claude-code-termux ────────────────────────────────────
info "Installing @xurxuo/claude-code-termux..."
npm install -g @xurxuo/claude-code-termux@latest

# ─── 5. Sanity-check / fallback wrapper ───────────────────────────────────────
BINARY="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude"
WRAPPER="/data/data/com.termux/files/usr/bin/claude"

if [[ ! -x "$BINARY" ]]; then
    warn "Native binary not found at expected path — downloading manually..."

    TMPDIR_SAFE="/data/data/com.termux/files/usr/tmp"
    WORK="$(mktemp -d "${TMPDIR_SAFE}/claude-install.XXXXXX")"
    trap 'rm -rf "$WORK"' EXIT

    VERSION=$(npm view @anthropic-ai/claude-code-linux-arm64 version 2>/dev/null || echo "")
    [[ -n "$VERSION" ]] || die "Could not resolve package version"
    [[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2}(-[0-9A-Za-z.-]+)?$ ]] || die "Invalid version: $VERSION"

    TARBALL="${WORK}/claude.tgz"
    EXTRACT="${WORK}/pkg"
    mkdir -p "$EXTRACT"

    info "Downloading v${VERSION}..."
    curl --proto '=https' --tlsv1.2 -fSL \
        "https://registry.npmjs.org/@anthropic-ai/claude-code-linux-arm64/-/claude-code-linux-arm64-${VERSION}.tgz" \
        -o "$TARBALL" || die "Download failed"

    # Validate tar entries (path traversal check)
    while IFS= read -r entry; do
        case "$entry" in
            ""|/*|../*|*/../*|*"/.."|*"/../"*) die "Unsafe tar entry: $entry" ;;
        esac
    done < <(tar -tzf "$TARBALL")

    tar -xzf "$TARBALL" -C "$EXTRACT"
    [[ -f "$EXTRACT/package/claude" ]] || die "Binary missing from tarball"

    mkdir -p "$(dirname "$BINARY")"
    install -m 0755 "$EXTRACT/package/claude" "$BINARY"
    ok "Binary installed: $BINARY"
fi

# ─── 6. Ensure wrapper uses grun ─────────────────────────────────────────────
# @xurxuo post-install creates this, but re-write to be sure
rm -f "$WRAPPER"
printf '%s\n' \
    '#!/data/data/com.termux/files/usr/bin/bash' \
    "exec grun ${BINARY} \"\$@\"" \
    > "$WRAPPER"
chmod +x "$WRAPPER"
ok "Wrapper written: $WRAPPER"

# Prevent npm from overwriting wrapper on future updates
BAK="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe"
[[ -f "$BAK" ]] && mv "$BAK" "${BAK}.bak" 2>/dev/null || true

# ─── 7. Final test ────────────────────────────────────────────────────────────
echo ""
info "Testing..."
grun "$BINARY" --version 2>/dev/null && ok "Claude binary OK" || {
    warn "Binary test returned non-zero (may still be fine)"
}

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Done! Claude Code installed.${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  claude --version   → check version"
echo "  claude             → start session"
echo ""
echo -e "${YELLOW}  export ANTHROPIC_API_KEY=sk-ant-...${NC}"
echo ""
