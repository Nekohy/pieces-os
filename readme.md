# 项目简介
![img](https://raw.githubusercontent.com/pieces-app/pieces-os-client-sdk-for-csharp/main/assets/pieces-logo.png)

逆向Pieces-OS GRPC流并转换为标准OpenAI接口的项目

所有模型均由 Pieces-OS 提供

本项目基于GPLV3协议开源

如果帮助到了你，能否给一个Star呢？ 
# 免责声明
本项目仅供学习交流使用，不得用于商业用途，如有侵权请联系删除
# DEMO站
**请善待公共服务，尽量自己搭建**

[https://pieces.nekomoon.cc](https://pieces.nekomoon.cc)
# 一键部署
[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nekohy/pieces-os&project-name=Pieces-OS&repository-name=Pieces-OS)

请注意下列环境变量！私人使用请添加API_KEY！
# todo
- [x] 流式实现
- [x] Serverless部署
- [ ] Docker支持
- [ ] 静态Proto JS

# 项目结构
```
api
    index.js Node.js的项目文件，即开即用
protos
    GPTInferenceService.proto # GPT的GRPC定义
    VertexInferenceService.proto # 其余几乎所有模型的GRPC定义
cloud_model.json 云端模型的配置文件，请提取unique中的模型使用
package.json 项目依赖
vercel.json Vercel部署配置文件
```
# 测试可用模型

## Claude 系列(Nextchat可将@换为-)
- **claude-3-5-sonnet@20240620**
- **claude-3-haiku@20240307**
- **claude-3-sonnet@20240229**
- **claude-3-opus@20240229**

## GPT 系列
- **gpt-3.5-turbo**
- **gpt-4**
- **gpt-4-turbo**
- **gpt-4o-mini**
- **gpt-4o**

## Gemini 系列
- **gemini-1.5-flash**
- **gemini-1.5-pro**

## 其他
- **chat-bison**
- **codechat-bison**

# 手动部署
安装 package.json 中定义的依赖库后，执行 node index.js 启动程序
# 测试命令
```
获取模型
curl --request GET 'http://127.0.0.1:8787/v1/models' \
  --header 'Content-Type: application/json'
```
```curl
请求
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

# 环境变量
## `API_PREFIX`
- **描述**: API 请求的前缀路径。
- **默认值**: `'/'`
- **获取方式**: `process.env.API_PREFIX || '/'`

## `API_KEY`
- **描述**: API 请求的密钥。
- **默认值**: 无 `''`
- **获取方式**: `process.env.API_KEY || ''`

## `MAX_RETRY_COUNT`
- **描述**: 最大重试次数。
- **默认值**: `3`
- **获取方式**: `process.env.MAX_RETRY_COUNT || 3`

## `RETRY_DELAY`
- **描述**: 重试延迟时间，单位为毫秒。
- **默认值**: `5000`（5秒）
- **获取方式**: `process.env.RETRY_DELAY || 5000`

## `PORT`
- **描述**: 服务监听的端口。
- **默认值**: `8787`
- **获取方式**: `process.env.PORT || 8787`


