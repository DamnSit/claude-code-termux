read -p "请输入你的 API Key: " API_KEY

echo "请选择要配置的 API 服务："
echo "1) DeepSeek (deepseek-v4-flash)"
echo "2) MiniMax (MiniMax-M3)"

read -p "请输入选项: " choice
if [ "$choice" = "1" ]; then
    echo "export ANTHROPIC_BASE_URL='https://api.deepseek.com/anthropic'" >> ~/.bashrc
    echo "export ANTHROPIC_AUTH_TOKEN='$API_KEY'" >> ~/.bashrc
    echo "export ANTHROPIC_MODEL='deepseek-v4-flash'" >> ~/.bashrc
elif [ "$choice" = "2" ]; then
    echo "export ANTHROPIC_BASE_URL='https://api.minimaxi.com/anthropic'" >> ~/.bashrc
    echo "export ANTHROPIC_AUTH_TOKEN='$API_KEY'" >> ~/.bashrc
    echo "export ANTHROPIC_MODEL='MiniMax-M3'" >> ~/.bashrc
fi
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
source ~/.bashrc

claude
