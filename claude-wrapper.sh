#!/data/data/com.termux/files/usr/bin/bash

# Claude Code Wrapper untuk Termux
# Supports: claude, claude -u, claude --update, claude [args...]

# Colors
RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[1;33m'
BLU='\033[1;36m'
CYN='\033[0;36m'
WHT='\033[1;37m'
GRY='\033[0;90m'
NC='\033[0m'
BLD='\033[1m'

# Animation helpers
typing_print() {
    local text="$1"
    local delay="${2:-0.02}"
    for ((i=0; i<${#text}; i++)); do
        printf "%s" "${text:$i:1}"
        sleep "$delay"
    done
    echo ""
}

spinner() {
    local pid=$1
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r${GRY}%s${NC}" "${spin:$i:1}"
        i=$(( (i + 1) % 10 ))
        sleep 0.1
    done
    printf "\r"
}

progress_bar() {
    local label="$1"
    local duration=${2:-2}
    local width=30
    echo -n "${label} "
    for ((i=0; i<=width; i++)); do
        sleep "$((duration / width))"
        printf "\r${label} ${GRN}▓${NC}%-$((width-i))s" | sed "s/▓/▓/g; s/ /░/g"
    done
    echo " ${GRN}✓${NC}"
}

CLAUDE_BINARY="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude"
INSTALLER_URL="https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh"

case "$1" in
  --update|-u|update)
    clear
    # ASCII Art Header
    echo -e "${CYN}"
    cat << 'EOF'
   ██████╗ ██████╗ ███████╗███╗   ███╗██╗
  ██╔════╝██╔═══██╗██╔════╝████╗ ████║██║
  ██║     ██║   ██║█████╗  ██╔████╔██║██║
  ██║     ██║   ██║██╔══╝  ██║╚██╔╝██║██║
  ╚██████╗╚██████╔╝███████╗██║ ╚═╝ ██║██║
   ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝
EOF
    echo -e "${NC}"
    echo -e "${BLD}${WHT}    Claude Code Updater${NC} ${GRY}•${NC} Termux Native${NC}"
    echo ""

    # Animated check
    echo -e "${YEL}▸${NC} Checking current version..."
    CURRENT=$(grun "$CLAUDE_BINARY" --version 2>/dev/null | head -1)
    echo -e "${GRN}  └─${NC} ${GRY}Current:${NC} ${CURRENT:-unknown}"
    echo ""

    echo -e "${YEL}▸${NC} Fetching latest version info..."
    LATEST=$(npm view @anthropic-ai/claude-code version 2>/dev/null)
    echo -e "${GRN}  └─${NC} ${GRY}Latest :${NC} ${LATEST:-unknown}"
    echo ""

    if [ "$CURRENT" = "$LATEST" ] || [ -z "$LATEST" ]; then
        echo -e "${GRN}▓▒░${NC} ${BLD}You're already on the latest version!${NC}"
        echo ""
        echo -e "${GRY}    $CURRENT${NC}"
        exit 0
    fi

    echo -e "${YEL}▸${NC} ${BLD}Initiating update sequence...${NC}"
    echo ""

    # Animated progress
    echo -e "${BLU}  ┌─────────────────────────────────────┐${NC}"
    echo -n "  │ "
    for i in {1..35}; do
        printf "${GRN}█${NC}"
        sleep 0.05
    done
    echo " │"
    echo -e "${BLU}  └─────────────────────────────────────┘${NC}"
    echo ""

    # Run update with spinner
    echo -e "${YEL}▸${NC} Downloading packages..."
    npm install -g @anthropic-ai/claude-code@latest @anthropic-ai/claude-code-linux-arm64@latest 2>&1 &
    spinner $!
    echo -e "${GRN}  └─${NC} ${GRN}✓${NC} Packages updated"
    echo ""

    # Show result
    echo -e "${YEL}▸${NC} Verifying installation..."
    NEW_VER=$(grun "$CLAUDE_BINARY" --version 2>/dev/null | head -1)
    echo ""

    # Success animation
    echo -e "${GRN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║      ██████╗  █████╗ ██████╗ ██████╗      ║
    ║      ██╔══██╗██╔══██╗██╔══██╗██╔══██╗     ║
    ║      ██║  ██║███████║██████╔╝██║  ██║     ║
    ║      ██║  ██║██╔══██║██╔══██╗██║  ██║     ║
    ║      ██████╔╝██║  ██║██║  ██║██████╔╝     ║
    ║      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝     ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo -e "${BLD}  ${WHT}Update Complete!${NC}"
    echo ""
    echo -e "  ${GRY}Previous:${NC} ${CURRENT:-unknown}"
    echo -e "  ${GRY}Current :${NC} ${BLD}${GRN}${NEW_VER}${NC}"
    echo ""
    echo -e "  ${GRY}Type 'claude' to start coding${NC}"
    echo ""
    ;;

  --version|-v)
    exec grun "$CLAUDE_BINARY" --version
    ;;

  --help|-h)
    echo -e "${CYN}"
    cat << 'EOF'
   ██████╗ ██████╗ ███████╗███╗   ███╗██╗
  ██╔════╝██╔═══██╗██╔════╝████╗ ████║██║
  ██║     ██║   ██║█████╗  ██╔████╔██║██║
  ██║     ██║   ██║██╔══╝  ██║╚██╔╝██║██║
  ╚██████╗╚██████╔╝███████╗██║ ╚═╝ ██║██║
   ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝
EOF
    echo -e "${NC}"
    echo -e "${BLD}Claude Code - Usage:${NC}"
    echo ""
    echo -e "  ${GRN}claude${NC}              Start Claude Code"
    echo -e "  ${GRN}claude -u${NC}           Update ke versi terbaru"
    echo -e "  ${GRN}claude --update${NC}     Update ke versi terbaru"
    echo -e "  ${GRN}claude -v${NC}          Show version"
    echo -e "  ${GRN}claude --version${NC}    Show version"
    echo -e "  ${GRN}claude --help${NC}       Show this help"
    echo ""
    ;;

  *)
    exec grun "$CLAUDE_BINARY" "${@}"
    ;;
esac