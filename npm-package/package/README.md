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

This package does not run a `postinstall` script. The native Claude Code
binary is installed or repaired only when you run `claude` or `claude update`.

## Termux Patches

- Platform detection: android → linux
- Uses `@anthropic-ai/claude-code-linux-arm64` native binary
- Launches the native glibc binary through `grun` on Android
- Compatible with Termux environment

## Requirements

- Android ARM64 (aarch64)
- Termux from F-Droid
- Node.js >= 18

## Usage

```bash
claude              # Start Claude Code
claude --version    # Check version
claude update       # Force update to latest native Claude Code package
```

The wrapper checks npm at most once per day. If
`@anthropic-ai/claude-code-linux-arm64` has a newer version, it automatically
installs the latest native Claude Code package before launching. The native package
uses npm `--force` because Termux reports `os=android` while the official
binary package is tagged `os=linux`. Set
`CLAUDE_CODE_TERMUX_NO_AUTO_UPDATE=1` to disable the daily check.
On Android, the wrapper launches the official glibc binary through `grun`.

## Security Notes

- No npm lifecycle scripts are defined.
- No install-time code runs automatically.
- No runtime dependency packages are bundled.
- The wrapper invokes `npm` only for explicit update/repair behavior.

## Auth

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or run `claude` and follow auth flow.

## Source

Based on @anthropic-ai/claude-code with Termux patches.
