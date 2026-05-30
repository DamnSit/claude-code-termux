# Claude Code Termux

![npm version](https://img.shields.io/npm/v/@xurxuo/claude-code-termux?style=flat-square&color=blue)
![npm downloads (monthly)](https://img.shields.io/npm/dm/@xurxuo/claude-code-termux?style=flat-square&color=brightgreen&label=Monthly%20Downloads)
![npm downloads (total)](https://img.shields.io/npm/dt/@xurxuo/claude-code-termux?style=flat-square&color=orange&label=Total%20Downloads)
![npm downloads (weekly)](https://img.shields.io/npm/dw/@xurxuo/claude-code-termux?style=flat-square&label=Weekly)
![license](https://img.shields.io/npm/l/@xurxuo/claude-code-termux?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/DamnSit/claude-code-termux?style=flat-square&color=yellow)
![GitHub forks](https://img.shields.io/github/forks/DamnSit/claude-code-termux?style=flat-square)

Run Claude Code natively on Android ARM64 with Termux.

This project makes the official Anthropic Linux ARM64 Claude Code binary usable on Android by launching it through `glibc-runner` (`grun`). You do not need Ubuntu, proot, a cloud VM, or a desktop computer.

## Requirements

- Android device with an ARM64 CPU.
- Termux from F-Droid.
- Internet access.
- An Anthropic API key from <https://console.anthropic.com/settings/keys>.

Do not use the Google Play version of Termux. It is outdated and commonly breaks package installs.

## Choose an Install Method

For most users, use the npm installer. It installs everything automatically, manages updates, and keeps your setup simple.

| Method | Best for | Command |
| --- | --- | --- |
| **NPM package (Recommended)** | **Most users — auto install & update** | **`npm install -g @xurxuo/claude-code-termux@latest`** |
| Shell installer | Beginners and manual installs | `curl -fsSL .../install-secure.sh \| bash` |
| Rust wrapper | Developers who want a compiled wrapper | Build from `rust-wrapper/` |

## Method 1: NPM Install (Recommended)

The easiest way to install. npm handles everything automatically.

```bash
pkg update
pkg install nodejs-lts
npm install -g @xurxuo/claude-code-termux@latest
```

Verify it works:

```bash
claude --version
claude
```

If an old `claude` file already exists, npm may report `EEXIST`. In that case, reinstall with:

```bash
npm install -g --force @xurxuo/claude-code-termux@latest
```

The npm wrapper:

- Installs or updates `@anthropic-ai/claude-code-linux-arm64@latest`.
- Uses `npm --force` only for the native package because Termux reports `os=android`, while the official native package is tagged as `os=linux`.
- Launches the official glibc binary through `grun`.
- Checks for native package updates at most once per day.

Force an update any time:

```bash
claude update
```

Disable daily auto-checks:

```bash
export CLAUDE_CODE_TERMUX_NO_AUTO_UPDATE=1
```

## Method 2: Shell Install

For users who prefer a direct shell installer without npm.

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install-secure.sh | bash
```

The secure installer downloads `CHECKSUMS.txt`, verifies `install.sh`, and refuses to run if verification fails.

If you want the shorter standard installer:

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash
```

The shell installer does the following:

1. Installs Termux dependencies such as `nodejs-lts`, `git`, `wget`, and `glibc-runner` when available.
2. Downloads the official `@anthropic-ai/claude-code-linux-arm64` binary.
3. Creates `$PREFIX/bin/claude`.
4. Runs the binary through `grun`.

Test it:

```bash
claude --version
claude
```

## Method 3: Rust Wrapper

The Rust wrapper is for developers who want a compiled launcher instead of the shell or npm launcher.

Build directly on Termux:

```bash
pkg update
pkg install rust
git clone https://github.com/DamnSit/claude-code-termux.git
cd claude-code-termux/rust-wrapper
cargo build --release
```

Install the compiled wrapper:

```bash
cp target/release/claude-termux $PREFIX/bin/claude
chmod +x $PREFIX/bin/claude
claude --version
```

Cross-compilation notes are in [rust-wrapper/BUILD.md](rust-wrapper/BUILD.md).

## API Key

Create an API key at <https://console.anthropic.com/settings/keys>.

For a temporary shell session:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

For a persistent setup, add it to your shell config:

```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.bashrc
source ~/.bashrc
```

You can also use Claude Code's normal login/auth flow by running:

```bash
claude
```

## Common Commands

| Command | What it does |
| --- | --- |
| `claude` | Start Claude Code |
| `claude --version` | Show the installed Claude Code version |
| `claude update` | Force update the native Claude Code package |
| `claude --update` | Same as `claude update` |
| `claude -update` | Same as `claude update` |

## Uninstall

For shell installs:

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/uninstall.sh | bash
```

For npm installs:

```bash
npm uninstall -g @xurxuo/claude-code-termux @anthropic-ai/claude-code-linux-arm64
```

If the official package was installed by accident and took over the `claude` command:

```bash
npm uninstall -g @anthropic-ai/claude-code
npm install -g --force @xurxuo/claude-code-termux@latest
```

Your `~/.claude/` settings are not removed.

## Security Verification

Download and verify checksums manually:

```bash
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/CHECKSUMS.txt -o CHECKSUMS.txt
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh -o install.sh
sha256sum -c CHECKSUMS.txt --ignore-missing
bash install.sh
```

Verify GPG signatures:

```bash
curl -fsSL https://github.com/DamnSit.gpg | gpg --import
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh -o install.sh
curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh.asc -o install.sh.asc
gpg --verify install.sh.asc install.sh
```

GPG key:

| Field | Value |
| --- | --- |
| Key ID | `63788A3CE203C94C` |
| Fingerprint | `6330DDFEF6C0B831A26699C863788A3CE203C94C` |
| Owner | DamnSit |

## Troubleshooting

### `npm error EBADPLATFORM`

This is expected when npm sees the official Linux package from Android. The wrapper uses `--force` for the native package and runs it through `grun`.

### `npm error EEXIST: file already exists ... /bin/claude`

An older installer or the official package already created `$PREFIX/bin/claude`.

```bash
npm uninstall -g @anthropic-ai/claude-code
npm install -g --force @xurxuo/claude-code-termux@latest
```

### `spawnSync ... claude ENOENT`

The native binary must be launched through `grun` on Termux. Update the wrapper:

```bash
npm install -g --force @xurxuo/claude-code-termux@latest
```

### API key not found

Set your key:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Project Layout

```text
.
├── install-secure.sh       # checksum-verified shell installer
├── install.sh              # standard shell installer
├── claude-wrapper.sh       # shell launcher
├── npm-package/package/    # @xurxuo/claude-code-termux npm package
├── rust-wrapper/           # optional Rust launcher
└── docs/                   # GitHub Pages site
```

## Links

- Website: <https://damnsit.github.io/claude-code-termux/>
- NPM package: <https://www.npmjs.com/package/@xurxuo/claude-code-termux>
- Claude Code: <https://docs.anthropic.com/en/docs/claude-code>
