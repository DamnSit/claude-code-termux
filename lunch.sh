cat >> ~/.bashrc << 'EOF'
export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="sk-"
export ANTHROPIC_MODEL="deepseek-v4-flash"
EOF

source ~/.bashrc

curl -fsSL https://raw.githubusercontent.com/DamnSit/claude-code-termux/main/install.sh | bash

# 创建配置目录（如果不存在）
mkdir -p ~/.claude

# 使用 cat 写入配置文件
cat > ~/.claude/settings.json << 'EOF'
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  }
}
EOF

claude