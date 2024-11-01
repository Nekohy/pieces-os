#!/bin/bash

# ANSI 颜色代码
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 进度条函数
progress_bar() {
    local duration=$1
    local message=$2
    local width=50
    local chars='/-\|'
    local percent=0
    local elapsed=0

    printf "${BLUE}➜${NC} ${message}  "

    while [ $percent -le 100 ]; do
        # 旋转动画
        printf "\r${BLUE}➜${NC} ${message} ["
        
        # 进度条
        local completed=$((percent * width / 100))
        printf "%${completed}s" | tr ' ' '█'
        printf "%$((width - completed))s" | tr ' ' '░'
        
        printf "] %3d%% " $percent
        
        # 旋转字符
        printf "%s" "${chars:$((elapsed % 4)):1}"
        
        sleep 0.05
        ((percent+=2))
        ((elapsed++))
    done
    
    printf "\r${GREEN}✓${NC} ${message} [████████████████████████████████████████████] 100%%\n"
}

# 彩色输出函数
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    error "请以 root 权限运行此脚本"
    exit 1
fi

# 显示欢迎信息
clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "          Pieces OS 安装脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# 检查网络环境
info "正在检查网络环境..."
progress_bar 2 "检查网络连接"
if ! ping -c 1 pieces.app &> /dev/null; then
    error "无法连接到 pieces.app，请检查您的网络环境。"
    exit 1
fi
info "网络连接正常 ✓"
echo

# 询问运行端口
read -p "$(echo -e ${GREEN}[INPUT]${NC}) 请输入要运行的端口 (默认: 8787): " PORT
PORT=${PORT:-8787}

# 询问 API_KEY
read -p "$(echo -e ${GREEN}[INPUT]${NC}) 请输入 API_KEY (直接回车使用默认值 sk-123456): " API_KEY
API_KEY=${API_KEY:-sk-123456}

# 询问是否需要设置其他环境变量
read -p "$(echo -e ${GREEN}[INPUT]${NC}) 是否需要设置其他环境变量？(y/n): " SET_OTHER_ENV
if [[ $SET_OTHER_ENV =~ ^[Yy]$ ]]; then
    info "请输入其他环境变量（格式：KEY=VALUE），每行一个，输入空行结束："
    OTHER_ENV=""
    while IFS= read -r line; do
        [[ -z "$line" ]] && break
        OTHER_ENV="$OTHER_ENV -e $line"
    done
fi

# 显示配置信息
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "配置信息确认"
echo "端口: $PORT"
echo "API_KEY: $API_KEY"
if [[ -n "$OTHER_ENV" ]]; then
    echo "其他环境变量: $OTHER_ENV"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# 检查 Docker 是否已安装
if ! command -v docker &> /dev/null; then
    warn "Docker 未安装。是否要安装 Docker？(y/n)"
    read -r install_docker
    if [[ $install_docker =~ ^[Yy]$ ]]; then
        info "正在安装 Docker..."
        progress_bar 3 "更新系统包列表"
        apt-get update &> /dev/null
        
        progress_bar 3 "安装依赖包"
        apt-get install -y apt-transport-https ca-certificates curl software-properties-common &> /dev/null
        
        progress_bar 2 "添加 Docker GPG 密钥"
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add - &> /dev/null
        
        progress_bar 2 "添加 Docker 仓库"
        add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" &> /dev/null
        
        progress_bar 3 "安装 Docker"
        apt-get update &> /dev/null && apt-get install -y docker-ce &> /dev/null
        
        info "Docker 安装完成 ✓"
    else
        error "Docker 未安装，无法继续。"
        exit 1
    fi
fi

# 使用 Docker 命令安装项目
info "正在拉取 Docker 镜像..."
progress_bar 5 "拉取镜像"
docker pull chb2024/pieces-os:latest &> /dev/null

info "正在启动容器..."
progress_bar 3 "启动容器"
docker run -d \
    --name pieces-os \
    -p $PORT:8787 \
    -e API_KEY=$API_KEY \
    $OTHER_ENV \
    --restart unless-stopped \
    chb2024/pieces-os:latest &> /dev/null

# 获取服务器 IP 地址
SERVER_IP=$(hostname -I | awk '{print $1}')

# 等待容器完全启动
progress_bar 2 "等待服务启动"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "部署完成！"
echo "访问地址: http://$SERVER_IP:$PORT"
echo "API_KEY: $API_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
