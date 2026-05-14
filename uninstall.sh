#!/data/data/com.termux/files/usr/bin/bash
# claude-code-termux uninstall.sh

set -uo pipefail
GRN='\033[1;32m'; YLW='\033[1;33m'; NC='\033[0m'

echo -e "\nUninstalling Claude Code Termux...\n"

npm uninstall -g @anthropic-ai/claude-code @anthropic-ai/claude-code-linux-arm64 2>/dev/null || true
echo -e "  ${GRN}✓${NC} npm packages removed"

MARK="# claude-code-termux"
for rc in ~/.bashrc ~/.zshrc; do
    [[ -f "$rc" ]] && sed -i "/$MARK/,/^$/d" "$rc" && echo -e "  ${GRN}✓${NC} alias removed from $rc"
done

echo -e "\n  ${YLW}Config ~/.claude/ left intact${NC}"

echo -e "\nDone.\n"