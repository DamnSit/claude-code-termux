#!/data/data/com.termux/files/usr/bin/bash
# ─────────────────────────────────────────────────────────────
#  Claude Code Termux — install.sh
#  github.com/DamnSit/claude-code-termux
#
#  curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
# ─────────────────────────────────────────────────────────────

set -uo pipefail

# ── colors ────────────────────────────────────────────────────
BLD='\033[1m'
RED='\033[1;31m'
GRN='\033[1;32m'
YLW='\033[1;33m'
CYN='\033[1;36m'
DIM='\033[2m'
NC='\033[0m'

log()  { printf "\n${CYN}▸${NC} %s\n" "$*"; }
ok()   { printf "  ${GRN}✓${NC} %s\n" "$*"; }
warn() { printf "  ${YLW}!${NC} %s\n" "$*"; }
die()  { printf "\n${RED}✗ %s${NC}\n" "$*" >&2; exit 1; }
sep()  { printf "\n${BLD}── %s ──────────────────────────────────────${NC}\n" "$*"; }

# ── constants ─────────────────────────────────────────────────
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
MOD_DIR="${PREFIX}/lib/node_modules"
CC_DIR="${MOD_DIR}/@anthropic-ai/claude-code"
ARM_DIR="${MOD_DIR}/@anthropic-ai/claude-code-linux-arm64"
CLAUDE_BIN="${ARM_DIR}/claude"
WRAPPER="${PREFIX}/bin/claude"
CFG_DIR="${HOME}/.claude"
CFG="${CFG_DIR}/settings.json"

# rc files
BASHRC="${HOME}/.bashrc"
ZSHRC="${HOME}/.zshrc"

# ── header ────────────────────────────────────────────────────
clear
printf "${CYN}${BLD}"
cat << 'EOF'
   ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
  ██║     ██║     ███████║██║   ██║██║  ██║█████╗
  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝
EOF
printf "${NC}"
printf "\n  ${BLD}Claude Code Termux${NC}  —  Native ARM64 + glibc-runner\n"
printf "  ${DIM}No Ubuntu. No proot-distro. Full native binary.${NC}\n\n"

# ── guard ─────────────────────────────────────────────────────
[[ "$(uname -m)" == "aarch64" ]] || die "Only supports ARM64 (aarch64)"
[[ -d "$PREFIX" ]]               || die "Termux PREFIX not found"

# ── step 1: update ────────────────────────────────────────────
sep "1/7  Update packages"
log "pkg update & upgrade..."
pkg update -y -q 2>/dev/null || true
pkg upgrade -y -q 2>/dev/null || true
ok "packages up to date"

# ── step 2: deps ──────────────────────────────────────────────
sep "2/7  Dependencies"
log "install nodejs-lts git wget patchelf proot tar..."
pkg install -y -q nodejs-lts git wget patchelf proot tar 2>/dev/null || \
    pkg install -y nodejs-lts git wget patchelf proot tar
ok "deps ok — node $(node -v)  npm $(npm -v)"

# ── step 3: claude code ───────────────────────────────────────
sep "3/7  Install @anthropic-ai/claude-code"
log "npm install (latest)..."
npm install -g @anthropic-ai/claude-code --force \
    2>&1 | grep -vE '^npm (warn|notice)' || true
[[ -d "$CC_DIR" ]] || die "claude-code install failed"
ok "installed → $CC_DIR"

# ── step 4: linux arm64 binary ────────────────────────────────
sep "4/7  Install native Linux ARM64 binary"
log "npm install @anthropic-ai/claude-code-linux-arm64..."
npm install -g @anthropic-ai/claude-code-linux-arm64 --force \
    2>&1 | grep -vE '^npm (warn|notice)' || true
[[ -f "$CLAUDE_BIN" ]] || die "linux-arm64 binary not found at $CLAUDE_BIN"
chmod +x "$CLAUDE_BIN"
ok "binary → $CLAUDE_BIN"

# ── step 5: patch platform detection ─────────────────────────
sep "5/7  Patch platform detection"

patch_file() {
    local file="$1"
    local label="$2"

    if [[ ! -f "$file" ]]; then
        warn "$label not found, skip"
        return
    fi

    # Check if already patched
    if grep -q "process.platform === 'android'" "$file" 2>/dev/null; then
        ok "$label already patched"
        return
    fi

    # Backup
    cp "$file" "${file}.bak"

    # Patch: change `process.platform` to android→linux ternary
    local tmp="${file}.tmp"

    # Find `const platform = process.platform` and replace
    awk '
    /const platform = process\.platform[^=]/ {
        print "const platform ="
        print "  process.platform === '"'"'android'"'"'"
        print "    ? '"'"'linux'"'"'"
        print "    : process.platform"
        next
    }
    { print }
    ' "$file" > "$tmp" && mv "$tmp" "$file"

    # Verify patch applied
    if grep -q "android" "$file"; then
        ok "patched: $label"
    else
        warn "$label patch may not have applied — check manually"
        cp "${file}.bak" "$file"
    fi
}

patch_file "${CC_DIR}/cli-wrapper.cjs" "cli-wrapper.cjs"
patch_file "${CC_DIR}/install.cjs"     "install.cjs"

# ── step 6: glibc-runner ─────────────────────────────────────
sep "6/7  glibc-runner"

if command -v grun &>/dev/null; then
    ok "glibc-runner already installed: $(grun --version 2>/dev/null || echo 'ok')"
else
    log "install glibc-repo..."
    pkg install -y -q glibc-repo 2>/dev/null || pkg install -y glibc-repo
    pkg update -y -q 2>/dev/null || true
    log "install glibc-runner..."
    pkg install -y -q glibc-runner 2>/dev/null || pkg install -y glibc-runner
    command -v grun &>/dev/null || die "grun not found after install"
    ok "glibc-runner ready"
fi

# verify binary runs via grun
log "verify native binary..."
VER=$(grun "$CLAUDE_BIN" --version 2>/dev/null | head -1 || true)
if [[ -n "$VER" ]]; then
    ok "binary OK → $VER"
else
    warn "binary test failed — but continuing (may need API key)"
fi

# ── step 7: api key + config ──────────────────────────────────
sep "7/7  API Key & Config"

# ── api key ───────────────────────────────────────────────────
FINAL_KEY="${ANTHROPIC_API_KEY:-}"

if [[ -n "$FINAL_KEY" ]]; then
    printf "\n  ${GRN}Key from env:${NC} %s...\n" "${FINAL_KEY:0:28}"
    printf "  Use this? [Y/n]: "
    read -r ans
    [[ "${ans}" == "n" || "${ans}" == "N" ]] && FINAL_KEY=""
fi

if [[ -z "$FINAL_KEY" ]]; then
    printf "\n  ${BLD}Anthropic API Key${NC}\n"
    printf "  ${DIM}→ console.anthropic.com/settings/keys${NC}\n\n"
    while true; do
        printf "  Key (Enter = skip): "
        read -rs raw; echo
        if   [[ -z "$raw" ]];           then warn "skipped — set manually later"; break
        elif [[ "$raw" == sk-ant-* ]];  then FINAL_KEY="$raw"; ok "key ok"; break
        else warn "must start with sk-ant-  try again"
        fi
    done
fi

# ── base url (optional, for custom endpoint) ──────────────────
printf "\n  ${BLD}Base URL${NC} ${DIM}(leave empty for default Anthropic)${NC}\n"
printf "  ${DIM}example: https://opencode.ai/zen${NC}\n\n"
printf "  Base URL (Enter = skip): "
read -r BASE_URL

# ── model ─────────────────────────────────────────────────────
printf "\n  ${BLD}Select model${NC}\n\n"
printf "  ${GRN}1)${NC} claude-sonnet-4-5         ${DIM}← recommended${NC}\n"
printf "  2) claude-opus-4-5           ${DIM}most intelligent${NC}\n"
printf "  3) claude-haiku-4-5          ${DIM}fastest${NC}\n"
printf "  4) claude-sonnet-4-0\n"
printf "  5) claude-opus-4-0\n"
printf "  6) claude-3-7-sonnet-20250219\n"
printf "  7) claude-3-5-haiku-20241022\n"
printf "  8) custom\n\n"
printf "  Choice [1]: "
read -r choice
[[ -z "$choice" ]] && choice="1"

case "$choice" in
    1) MODEL="claude-sonnet-4-5" ;;
    2) MODEL="claude-opus-4-5" ;;
    3) MODEL="claude-haiku-4-5" ;;
    4) MODEL="claude-sonnet-4-0" ;;
    5) MODEL="claude-opus-4-0" ;;
    6) MODEL="claude-3-7-sonnet-20250219" ;;
    7) MODEL="claude-3-5-haiku-20241022" ;;
    8) printf "  Model name: "; read -r MODEL; [[ -z "$MODEL" ]] && MODEL="claude-sonnet-4-5" ;;
    *) warn "invalid, using default"; MODEL="claude-sonnet-4-5" ;;
esac
ok "model: $MODEL"

# ── write settings.json ───────────────────────────────────────
mkdir -p "$CFG_DIR"

# build env block pure bash
ENV_BLOCK="    \"ANTHROPIC_MODEL\": \"${MODEL}\""
[[ -n "$FINAL_KEY" ]] && ENV_BLOCK="${ENV_BLOCK},\n    \"ANTHROPIC_API_KEY\": \"${FINAL_KEY}\""
[[ -n "$BASE_URL"  ]] && ENV_BLOCK="${ENV_BLOCK},\n    \"ANTHROPIC_BASE_URL\": \"${BASE_URL}\""

printf '{\n  "env": {\n%b\n  },\n  "autoUpdatesChannel": "latest"\n}\n' \
    "$ENV_BLOCK" > "$CFG"

ok "~/.claude/settings.json"

# ── wrapper ────────────────────────────────────────────────────
MARK="# claude-code-termux"
TMPDIR_LINE="export TMPDIR=\"\${TMPDIR:-${PREFIX}/tmp}\""

# Copy wrapper script to bin
WRAPPER_SRC="$(cd "$(dirname "$0")" && pwd)/claude-wrapper.sh"
WRAPPER_DST="${PREFIX}/bin/claude"

if [ -f "$WRAPPER_SRC" ]; then
    cp "$WRAPPER_SRC" "$WRAPPER_DST"
    chmod +x "$WRAPPER_DST"
    ok "wrapper → $WRAPPER_DST"
else
    # Fallback: create inline wrapper if source not found
    cat > "$WRAPPER_DST" << 'WRAPPER_EOF'
#!/data/data/com.termux/files/usr/bin/bash
CLAUDE_BINARY="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude"
UNINSTALL_URL="https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh"
case "$1" in
  --update|-update|update)
    echo "🔄 Updating Claude Code..."
    npm install -g @anthropic-ai/claude-code@latest @anthropic-ai/claude-code-linux-arm64@latest
    ;;
  --uninstall|-uninstall|uninstall)
    echo "🗑️ Uninstalling Claude Code..."
    curl -fsSL "$UNINSTALL_URL" | bash
    ;;
  *)
    exec grun "$CLAUDE_BINARY" "$@"
    ;;
esac
WRAPPER_EOF
    chmod +x "$WRAPPER_DST"
    ok "wrapper (inline) → $WRAPPER_DST"
fi

# Add to shell rc - remove old alias first
for rc in "$BASHRC" "$ZSHRC"; do
    [[ -f "$rc" ]] || touch "$rc"
    # Remove old alias if exists
    sed -i "/^alias claude=/d" "$rc" 2>/dev/null || true
    grep -q "$MARK" "$rc" && sed -i "/$MARK/,/^$/d" "$rc"
    printf '\n%s\n%s\n' "$MARK" "$TMPDIR_LINE" >> "$rc"
done

ok "PATH updated → ~/.bashrc & ~/.zshrc"

# apply to current session
export TMPDIR="${PREFIX}/tmp"
export PATH="${PREFIX}/bin:$PATH"

# ── smoke test ────────────────────────────────────────────────
sep "Smoke test"
if grun "$CLAUDE_BIN" --version 2>/dev/null | grep -qE "[0-9]+\.[0-9]+"; then
    ok "$(grun "$CLAUDE_BIN" --version 2>/dev/null | head -1)"
else
    warn "smoke test failed — try manually: grun $CLAUDE_BIN --version"
fi

# ── done ──────────────────────────────────────────────────────
printf "\n${GRN}${BLD}"
printf "  ╔══════════════════════════════════════════════╗\n"
printf "  ║   ✅  Claude Code Termux ready to use!       ║\n"
printf "  ╚══════════════════════════════════════════════╝\n"
printf "${NC}\n"

[[ -n "$FINAL_KEY" ]] \
    && printf "  ${BLD}Key  :${NC} %s...%s\n" "${FINAL_KEY:0:28}" "${FINAL_KEY: -4}" \
    || printf "  ${YLW}Key  : not set — export ANTHROPIC_API_KEY=...${NC}\n"
[[ -n "$BASE_URL" ]] \
    && printf "  ${BLD}URL  :${NC} %s\n" "$BASE_URL"
printf "  ${BLD}Model:${NC} %s\n\n" "$MODEL"

# Auto-source ~/.bashrc for this session
log "sourcing ~/.bashrc..."
source ~/.bashrc 2>/dev/null || true
source ~/.zshrc 2>/dev/null || true
ok "~/.bashrc & ~/.zshrc loaded"

printf "  ${CYN}claude${NC}              ← run\n\n"
printf "  ${DIM}Tip: run with 'source install.sh' to activate PATH immediately${NC}\n"
printf "  ${DIM}If issues: run bash install.sh again, or check TROUBLESHOOTING.md${NC}\n\n"