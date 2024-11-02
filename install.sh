#!/bin/bash

# 进度条函数 (文字版)
show_progress() {
    local duration=$1
    local prefix=$2
    local width=50
    local fill="#"
    local empty="-"

    printf "\r"
    for ((i = 0; i <= width; i++)); do
        local progress=$((i * 100 / width))
        printf "\r%s [" "$prefix"
        printf "%${i}s" | tr " " "$fill"
        printf "%$((width - i))s" | tr " " "$empty"
        printf "] %3d%%" $progress
        sleep $(echo "scale=4; $duration/$width" | bc)
    done
    printf "\n"
}

# 彩色输出函数
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    error "请以 root 权限运行此脚本"
    exit 1
fi

# 欢迎信息
clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "          Pieces OS 安装脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# 步骤 1/7: 检查网络环境
echo "步骤 1/7: 检查网络环境..."
echo "正在检查网络连接..."
show_progress 2 "检查网络连接"
if ! ping -c 1 pieces.app &> /dev/null; then
    error "无法连接到 pieces.app，请检查您的网络环境。"
    exit 1
fi
echo "网络连接正常 ✓"
echo

# 步骤 2/7: 配置基本信息
echo "步骤 2/7: 配置基本信息..."
read -p "$(echo -e ${GREEN}[INPUT]${NC}) 请输入要运行的端口 (默认: 8787): " PORT
PORT=${PORT:-8787}
echo "端口设置完成: $PORT"

read -p "$(echo -e ${GREEN}[INPUT]${NC}) 请输入 API_KEY (直接回车使用默认值 sk-123456): " API_KEY
API_KEY=${API_KEY:-sk-123456}
echo "API_KEY 设置完成: $API_KEY"


# 步骤 3/7: 配置环境变量
echo "步骤 3/7: 配置环境变量..."
read -p "$(echo -e ${GREEN}[INPUT]${NC}) 是否需要设置其他环境变量？(y/n): " SET_OTHER_ENV
if [[ $SET_OTHER_ENV =~ ^[Yy]$ ]]; then
    echo "请输入其他环境变量（格式：KEY=VALUE），每行一个，输入空行结束："
    OTHER_ENV=""
    while IFS= read -r line; do
        [[ -z "$line" ]] && break
        OTHER_ENV="$OTHER_ENV -e $line"
        echo "已添加环境变量: $line"
    done
fi

# 步骤 4/7: 检查 Docker 环境
echo "步骤 4/7: 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    warn "未检测到 Docker，需要安装 Docker 环境"
    read -p "$(echo -e ${GREEN}[INPUT]${NC}) 是否现在安装 Docker？(y/n): " install_docker
    if [[ $install_docker =~ ^[Yy]$ ]]; then
        echo "开始安装 Docker..."
        echo "正在更新系统包列表..."
        show_progress 3 "更新系统包列表"
        apt-get update &> /dev/null

        echo "正在安装依赖包..."
        show_progress 3 "安装依赖包"
        apt-get install -y apt-transport-https ca-certificates curl software-properties-common &> /dev/null

        echo "正在添加 Docker GPG 密钥..."
        show_progress 2 "添加 Docker GPG 密钥"
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add - &> /dev/null

        echo "正在添加 Docker 仓库..."
        show_progress 2 "添加 Docker 仓库"
        add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" &> /dev/null

        echo "正在安装 Docker..."
        show_progress 3 "安装 Docker"
        apt-get update &> /dev/null && apt-get install -y docker-ce &> /dev/null
        echo "Docker 安装完成 ✓"
    else
        error "Docker 未安装，无法继续。"
        exit 1
    fi
fi


# 步骤 5/7: 拉取 Docker 镜像
echo "步骤 5/7: 拉取 Docker 镜像..."
echo "正在拉取镜像..."
show_progress 5 "拉取镜像中"
docker pull chb2024/pieces-os:latest &> /dev/null
echo "镜像拉取完成 ✓"

# 步骤 6/7: 启动容器
echo "步骤 6/7: 启动容器..."
echo "正在启动容器..."
show_progress 3 "启动容器中"
docker run -d \
    --name pieces-os \
    -p $PORT:8787 \
    -e API_KEY=$API_KEY \
    $OTHER_ENV \
    --restart unless-stopped \
    chb2024/pieces-os:latest &> /dev/null
echo "容器启动完成 ✓"


# 步骤 7/7: 完成部署
echo "步骤 7/7: 完成部署..."
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "正在等待服务启动..."
show_progress 2 "等待服务启动"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "部署完成！"
echo "访问地址: http://$SERVER_IP:$PORT"
echo "API_KEY: $API_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
