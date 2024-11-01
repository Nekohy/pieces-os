export default function Component() {
  return (
    <pre className="text-sm bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto">
      {`# 使用 Node.js 18 作为基础镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用程序代码
COPY . .

# 暴露端口（根据您的应用设置）
EXPOSE 8787

# 运行应用
CMD ["node", "api/index.js"]`}
    </pre>
  )
}
