#!/data/data/com.termux/files/usr/bin/bash

# Claude Code Wrapper untuk Termux
# Supports: claude, claude -u, claude --update, claude [args...]

CLAUDE_BINARY="/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude"
INSTALLER_URL="https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh"

case "$1" in
  --update|-u|update)
    echo "🔄 Updating Claude Code ke versi terbaru..."
    echo ""
    npm install -g @anthropic-ai/claude-code@latest @anthropic-ai/claude-code-linux-arm64@latest
    echo ""
    echo "✅ Update selesai!"
    echo "Versi sekarang: $(grun "$CLAUDE_BINARY" --version 2>/dev/null | head -1)"
    ;;
  --version|-v)
    exec grun "$CLAUDE_BINARY" --version
    ;;
  --help|-h)
    echo "Claude Code - Usage:"
    echo ""
    echo "  claude              Start Claude Code"
    echo "  claude -u           Update Claude Code ke versi terbaru"
    echo "  claude --update     Update Claude Code ke versi terbaru"
    echo "  claude -v           Show version"
    echo "  claude --version    Show version"
    echo "  claude --help       Show this help"
    echo ""
    ;;
  *)
    exec grun "$CLAUDE_BINARY" "${@}"
    ;;
esac