# Pieces-OS API Bridge

<div align="center">

![Pieces Logo](https://raw.githubusercontent.com/pieces-app/pieces-os-client-sdk-for-csharp/main/assets/pieces-logo.png)

将 Pieces-OS GRPC 流转换为标准 OpenAI 接口的开源项目

[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nekohy/pieces-os&project-name=Pieces-OS&repository-name=Pieces-OS)
[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=pieces-os&type=docker&image=chb2024%2Fpieces-os%3Alatest&regions=was&env%5B%5D=&ports=8787%3Bhttp%3B%2F)

[DEMO - Vercel](https://pieces.nekomoon.cc) | [DEMO - Cloudflare Worker](https://pieces.464888.xyz)

</div>

## 📑 目录

- [项目简介](#项目简介)
- [免责声明](#免责声明)
- [快速部署](#快速部署)
- [支持模型](#支持模型)
- [项目结构](#项目结构)
- [使用说明](#使用说明)
- [环境配置](#环境配置)
- [Docker部署](#docker部署)

## 📖 项目简介

本项目基于 GPLV3 协议开源，实现了将 Pieces-OS 的 GRPC 流转换为标准 OpenAI 接口的功能。所有模型均由 Pieces-OS 提供。

> ⚠️ **请善待公共服务，建议自行部署使用**

## ⚖️ 免责声明

本项目仅供学习交流使用，不得用于商业用途。如有侵权请联系删除。

## 🚀 快速部署

### 一键部署选项

#### 1. 服务器一键安装脚本 (适用于 Ubuntu, Debian 等)
```bash
curl -sSL https://raw.githubusercontent.com/Nekohy/pieces-os/main/install.sh | sudo bash
```
脚本会自动安装 Docker 并部署本项目，只需按照提示输入相关配置即可。

#### 2. Vercel 部署
[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nekohy/pieces-os&project-name=Pieces-OS&repository-name=Pieces-OS)

点击上方按钮一键部署到 Vercel 平台。

#### 3. Koyeb 部署
[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?name=pieces-os&type=docker&image=chb2024%2Fpieces-os%3Alatest&regions=was&env%5B%5D=&ports=8787%3Bhttp%3B%2F)

点击上方按钮一键部署到 Koyeb 平台。

> ⚠️ **注意**: 请务必在部署时设置 API_KEY 环境变量以保护你的服务。

### Cloudflare Worker 反代配置
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    url.hostname = 'abcdefg.koyeb.app';  // 替换为你的部署地址
    
    const newRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'POST' ? request.body : null,
      redirect: 'follow'
    });

    return fetch(newRequest);
  }
}
```

## 🤖 支持模型

### Claude 系列
- `claude-3-5-sonnet@20240620`
- `claude-3-haiku@20240307`
- `claude-3-sonnet@20240229`
- `claude-3-opus@20240229`

### GPT 系列
- `gpt-3.5-turbo`
- `gpt-4`
- `gpt-4-turbo`
- `gpt-4o-mini`
- `gpt-4o`

### Gemini 系列
- `gemini-pro`
- `gemini-1.5-flash`
- `gemini-1.5-pro`

### 其他模型
- `chat-bison`
- `codechat-bison`

## 📁 项目结构

```
.
├── api/
│   └── index.js          # Node.js 主程序文件
├── protos/
│   ├── GPTInferenceService.proto        # GPT服务定义
│   └── VertexInferenceService.proto     # 其他模型服务定义
├── cloud_model.json      # 云端模型配置文件
├── package.json         # 项目依赖
└── vercel.json         # Vercel部署配置
```

## 🔧 使用说明

### API测试命令

获取模型列表：
```bash
curl --request GET 'http://127.0.0.1:8787/v1/models' \
  --header 'Content-Type: application/json'
```

发送对话请求：
```bash
curl --request POST 'http://127.0.0.1:8787/v1/chat/completions' \
  --header 'Content-Type: application/json' \
  --data '{
    "messages": [
      {
        "role": "user",
        "content": "你好！"
      }
    ],
    "model": "gpt-4o",
    "stream": true
  }'
```

## ⚙️ 环境配置

| 环境变量 | 描述 | 默认值 |
|---------|------|--------|
| `API_PREFIX` | API请求前缀 | `/` |
| `API_KEY` | API访问密钥 | `''` |
| `MAX_RETRY_COUNT` | 最大重试次数 | `3` |
| `RETRY_DELAY` | 重试延迟(ms) | `5000` |
| `PORT` | 服务端口 | `8787` |

## 🐳 Docker部署

### 使用 Docker Compose（推荐）

1. 下载配置文件：
```bash
curl -sSL https://raw.githubusercontent.com/Nekohy/pieces-os/main/docker-compose.yml
```

2. 启动服务：
```bash
docker-compose up -d
```

### 使用 Docker 命令

1. 拉取镜像：
```bash
docker pull chb2024/pieces-os:latest
```

2. 运行容器：
```bash
docker run -d \
  --name pieces-os \
  -p 8787:8787 \
  -e API_KEY=sk-123456 \
  --restart unless-stopped \
  chb2024/pieces-os:latest
```

### Docker 管理命令

```bash
# 停止容器
docker stop pieces-os

# 启动容器
docker start pieces-os

# 重启容器
docker restart pieces-os

# 删除容器
docker rm pieces-os
```

---

如果这个项目对你有帮助，欢迎给个 Star ⭐️
