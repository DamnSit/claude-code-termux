use anyhow::Result;
use clap::{Parser, Subcommand};
use crossterm::style::Stylize;
use std::{
    path::PathBuf,
    process::{Command, Stdio},
};

const CLAUDE_BINARY: &str = "/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/claude";
const CLAUDE_NODE: &str = "/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code/bin/run.js";
const INSTALLER_URL: &str = "https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh";

#[derive(Parser)]
#[command(name = "claude")]
#[command(version = "1.0.0")]
#[command(about = "Claude Code Termux - Native ARM64 wrapper", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Update to latest version
    Update,
    /// Uninstall Claude Code
    Uninstall,
    /// Show version
    Version,
    /// Install dependencies
    Install,
    /// Show this help
    Help,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Update) => update()?,
        Some(Commands::Uninstall) => uninstall()?,
        Some(Commands::Version) => version()?,
        Some(Commands::Install) => install()?,
        Some(Commands::Help) => help()?,
        None => run_claude()?,
    }

    Ok(())
}

fn check_deps() -> bool {
    // Check if grun exists
    if Command::new("which").arg("grun").output().map(|o| o.status.success()).unwrap_or(false) {
        // Check if claude binary exists
        if PathBuf::from(CLAUDE_BINARY).exists() {
            return true;
        }
    }
    false
}

fn install_deps() -> Result<()> {
    println!("{}", "Installing dependencies...".yellow());

    // Check if nodejs installed
    if !PathBuf::from("/data/data/com.termux/files/usr/bin/node").exists() {
        println!("  {} Installing nodejs...", "▸".yellow());
        Command::new("pkg")
            .args(["install", "-y", "nodejs-lts"])
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()?;
    }

    // Check if grun installed
    if !PathBuf::from("/data/data/com.termux/files/usr/bin/grun").exists() {
        println!("  {} Installing grun (glibc-runner)...", "▸".yellow());
        Command::new("pkg")
            .args(["install", "-y", "grun"])
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()?;
    }

    // Install npm packages
    println!("  {} Installing Claude Code packages...", "▸".yellow());
    Command::new("npm")
        .args(["install", "-g", "@anthropic-ai/claude-code", "@anthropic-ai/claude-code-linux-arm64"])
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;

    println!("{}", "✓ Dependencies installed!".green());
    Ok(())
}

fn run_claude() -> Result<()> {
    // Check if dependencies are installed
    if !check_deps() {
        println!("{}", "Dependencies not found. Installing...".yellow());
        install_deps()?;
        println!();
    }

    // Check if claude binary exists
    let claude_path = PathBuf::from(CLAUDE_BINARY);
    let node_path = PathBuf::from(CLAUDE_NODE);

    let (cmd, args) = if node_path.exists() {
        // Use node for JS layer
        ("node".to_string(), vec![CLAUDE_NODE.to_string()])
    } else if claude_path.exists() {
        // Use native binary with grun
        ("grun".to_string(), vec![CLAUDE_BINARY.to_string()])
    } else {
        println!("{}", "Claude not installed. Installing...".yellow());
        install_deps()?;

        // Retry check
        if !check_deps() {
            anyhow::bail!("Installation failed. Try running:\n  curl -fsSL {} | bash", INSTALLER_URL);
        }

        // Try again
        if node_path.exists() {
            ("node".to_string(), vec![CLAUDE_NODE.to_string()])
        } else if claude_path.exists() {
            ("grun".to_string(), vec![CLAUDE_BINARY.to_string()])
        } else {
            anyhow::bail!("Claude binary not found after installation.");
        }
    };

    // Get all arguments except the program name
    let user_args: Vec<String> = std::env::args().skip(1).collect();

    // Execute
    let mut cmd_obj = Command::new(&cmd);
    cmd_obj.args(&args).args(&user_args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    let status = cmd_obj.status()?;
    std::process::exit(status.code().unwrap_or(1));
}

fn version() -> Result<()> {
    let node_path = PathBuf::from(CLAUDE_NODE);
    let claude_path = PathBuf::from(CLAUDE_BINARY);

    if node_path.exists() {
        let output = Command::new("node")
            .args([CLAUDE_NODE, "--version"])
            .output()?;
        print!("{}", String::from_utf8_lossy(&output.stdout));
    } else if claude_path.exists() {
        let output = Command::new("grun")
            .arg(CLAUDE_BINARY)
            .arg("--version")
            .output()?;
        print!("{}", String::from_utf8_lossy(&output.stdout));
    } else {
        println!("Claude Code not installed. Run 'claude install' first.");
    }
    Ok(())
}

fn help() -> Result<()> {
    print!(
        r#"
   ██████╗ ██████╗ ███████╗███╗   ███╗██╗
  ██╔════╝██╔═══██╗██╔════╝████╗ ████║██║
  ██║     ██║   ██║█████╗  ██╔████╔██║██║
  ██║     ██║   ██║██╔══╝  ██║╚██╔╝██║██║
  ╚██████╗╚██████╔╝███████╗██║ ╚═╝ ██║██║
   ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝

Claude Code - Usage:

  claude              Start Claude Code (auto-install if needed)
  claude install      Install dependencies
  claude update       Update to latest version
  claude uninstall   Uninstall Claude Code
  claude version     Show version

"#
    );
    Ok(())
}

fn install() -> Result<()> {
    install_deps()
}

fn update() -> Result<()> {
    // Clear screen
    print!("\x1B[2J\x1B[1;1H");

    // Header
    println!(
        "{}",
        r#"
   ██████╗ ██████╗ ███████╗███╗   ███╗██╗
  ██╔════╝██╔═══██╗██╔════╝████╗ ████║██║
  ██║     ██║   ██║█████╗  ██╔████╔██║██║
  ██║     ██║   ██║██╔══╝  ██║╚██╔╝██║██║
  ╚██████╗╚██████╔╝███████╗██║ ╚═╝ ██║██║
   ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝"#
            .cyan()
    );

    println!("    {}  {} Termux Native", "Claude Code Updater".bold(), "•".dim());
    println!();

    // Check which package is installed
    let xurxuo_installed = PathBuf::from("/data/data/com.termux/files/usr/lib/node_modules/@xurxuo/claude-code-termux").exists();
    let anthropic_installed = PathBuf::from("/data/data/com.termux/files/usr/lib/node_modules/@anthropic-ai/claude-code").exists();

    // Update npm packages (settings.json TIDAK disentuh)
    println!("{} Updating packages...", "▸".yellow());
    println!("  └─ {} Settings preserved", "✓".green());

    if xurxuo_installed {
        Command::new("npm")
            .args(["install", "-g", "@xurxuo/claude-code-termux@latest", "@anthropic-ai/claude-code-linux-arm64@latest"])
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()?;
    } else if anthropic_installed {
        Command::new("npm")
            .args(["install", "-g", "@anthropic-ai/claude-code@latest", "@anthropic-ai/claude-code-linux-arm64@latest"])
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()?;
    }

    println!("  └─ {} Packages updated", "✓".green());
    println!();

    // Success
    println!(
        "{}",
        r#"
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║      ██████╗  █████╗ ██████╗ ██████╗      ║
    ║      ██╔══██╗██╔══██╗██╔══██╗██╔══██╗     ║
    ║      ██║  ██║███████║██████╔╝██║  ██║     ║
    ║      ██║  ██║██╔══██║██╔══██╗██║  ██║     ║
    ║      ██████╔╝██║  ██║██║  ██║██████╔╝     ║
    ║      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝     ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝"#
            .green()
    );

    println!("  {} {}", "Update Complete!".bold().white(), "\n");
    println!("  {} Type 'claude' to start coding", "claude".cyan());
    println!();

    Ok(())
}

fn uninstall() -> Result<()> {
    println!("{} Uninstalling Claude Code Termux...", "▸".yellow());
    println!("  └─ {} Settings preserved (~/.claude/settings.json)", "✓".green());

    // Remove npm packages (settings.json TIDAK disentuh)
    Command::new("npm")
        .args(["uninstall", "-g", "@xurxuo/claude-code-termux", "@anthropic-ai/claude-code", "@anthropic-ai/claude-code-linux-arm64"])
        .output()?;

    println!("  └─ {} Packages removed", "✓".green());
    println!("{}", "Uninstall complete!".green());
    Ok(())
}