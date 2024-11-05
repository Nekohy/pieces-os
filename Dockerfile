# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装生产环境依赖
RUN npm ci --only=production

# 复制应用程序代码
COPY . .

# 暴露端口（根据应用需要）
EXPOSE 8787

# 启动应用和健康检查
CMD ["sh", "-c", "node api/index.js & node healthCheck.js && wait"]
