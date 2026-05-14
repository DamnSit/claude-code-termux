# @xurxuo/claude-code-termux

Claude Code for Termux/Android ARM64 - with Termux patches.

## Install

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts -y
npm install -g @xurxuo/claude-code-termux
claude --version
claude
```

## Termux Patches

- Platform detection: android → linux
- Uses `@anthropic-ai/claude-code-linux-arm64` native binary
- Compatible with Termux environment

## Requirements

- Android ARM64 (aarch64)
- Termux from F-Droid
- Node.js >= 18

## Usage

```bash
claude              # Start Claude Code
claude --version    # Check version
claude update       # Force update to latest Claude Code packages
```

The wrapper checks npm at most once per day. If
`@anthropic-ai/claude-code-linux-arm64` has a newer version, it automatically
installs the latest Claude Code packages before launching. Set
`CLAUDE_CODE_TERMUX_NO_AUTO_UPDATE=1` to disable the daily check.

## Auth

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or run `claude` and follow auth flow.

## Source

Based on @anthropic-ai/claude-code with Termux patches.
