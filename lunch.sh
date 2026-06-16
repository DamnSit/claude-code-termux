read -p "请输入你的 API Key: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "错误：API Key 不能为空！"
    exit 1
fi

echo "请选择要配置的 API 服务："
echo "1) DeepSeek (deepseek-v4-flash)"
echo "2) MiniMax (MiniMax-M3)"
read -p "请输入选项: " choice

if [ "$choice" != "1" ] && [ "$choice" != "2" ]; then
    echo "错误：无效选项"
    exit 1
fi

if [ "$choice" = "1" ]; then
    BASE_URL="https://api.deepseek.com/anthropic"
    MODEL="deepseek-v4-flash"
else
    BASE_URL="https://api.minimaxi.com/anthropic"
    MODEL="MiniMax-M3"
fi

# 删除旧配置
sed -i '/ANTHROPIC_/d' ~/.bashrc

# 在开头插入新配置
sed -i "1i # Anthropic API Configuration\nexport ANTHROPIC_BASE_URL=\"$BASE_URL\"\nexport ANTHROPIC_AUTH_TOKEN=\"$API_KEY\"\nexport ANTHROPIC_MODEL=\"$MODEL\"\n" ~/.bashrc
source ~/.bashrc



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
