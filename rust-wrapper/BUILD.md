# Building the Rust Wrapper

The Rust wrapper is optional. Use it if you want a compiled launcher instead of the shell or npm launcher.

Most users should use the shell installer or npm package from the main README.

## Build on Termux

```bash
pkg update
pkg install git rust
git clone https://github.com/DamnSit/claude-code-termux.git
cd claude-code-termux/rust-wrapper
cargo build --release
```

The binary will be created at:

```text
target/release/claude-termux
```

Install it into your Termux PATH:

```bash
cp target/release/claude-termux $PREFIX/bin/claude
chmod +x $PREFIX/bin/claude
claude --version
```

## Cross-Compile from Linux

Install the ARM64 target and cross compiler:

```bash
rustup target add aarch64-unknown-linux-gnu
sudo apt install gcc-aarch64-linux-gnu
```

Build:

```bash
cd rust-wrapper
cargo build --release --target aarch64-unknown-linux-gnu
```

The binary will be created at:

```text
target/aarch64-unknown-linux-gnu/release/claude-termux
```

Copy that binary to Termux and place it at:

```text
$PREFIX/bin/claude
```

## Static Build Notes

Static builds may need extra toolchain setup and can fail depending on your Termux/Rust environment.

Try:

```bash
pkg install rust binutils
RUSTFLAGS="-C target-feature=+crt-static" cargo build --release
```

Or use a musl target if your environment supports it:

```bash
rustup target add aarch64-unknown-linux-musl
cargo build --release --target aarch64-unknown-linux-musl
```

## Troubleshooting

### `linker aarch64-linux-gnu-gcc not found`

On Ubuntu/Debian:

```bash
sudo apt install gcc-aarch64-linux-gnu
```

### `cargo build` fails on Termux

Update packages and retry:

```bash
pkg update
pkg upgrade
pkg install rust binutils
cargo clean
cargo build --release
```

### `claude` still points to another package

An older npm or shell install may already own `$PREFIX/bin/claude`.

```bash
rm -f $PREFIX/bin/claude
cp target/release/claude-termux $PREFIX/bin/claude
chmod +x $PREFIX/bin/claude
```
