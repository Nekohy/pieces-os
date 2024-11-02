# 使用 Node.js 官方镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package 文件
COPY package*.json ./

# 清理并安装依赖
RUN npm install -g npm@latest && \
    npm install

# 复制其余文件
COPY . .

# 启动命令
CMD ["node", "api/index.js"]
