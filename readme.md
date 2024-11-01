# 项目简介
![img](https://raw.githubusercontent.com/pieces-app/pieces-os-client-sdk-for-csharp/main/assets/pieces-logo.png)

逆向Piece-OS GRPC流并转换为标准OpenAI接口的项目

所有模型均由 Piece-OS 提供

本项目基于GPLV3协议开源

如果帮助到了你，能否给一个Star呢？ 
# 一键部署
[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nekohy/pieces-os&project-name=Pieces-OS&repository-name=Pieces-OS)
请注意下列环境变量！私人使用请添加API_KEY！
# todo
- [x] 流式实现
- [x] Serverless部署
- [ ] 静态Proto JS

# 项目结构
```
GPTInferenceService.proto # GPT的GRPC定义
VertexInferenceService.proto # 其余几乎所有模型的GRPC定义
index.js Node.js的项目文件，即开即用
cloud_model.json 云端模型的配置文件，请提取unique中的模型使用
```
# 测试可用模型

## Claude 系列
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

# 未测试模型

## Phi 系列
- **Phi-3-mini-4k-instruct.q4_K_M**
- **Phi-3-mini-128k-instruct.q4_K_M**

## Hermes 系列
- **neuralhermes-2.5-mistral-7b.q4_K_M**

## LLaMA 系列
- **llama-3-8b-instruct.q4_K_M**
- **llama-2-7b-chat.q4_K_M**

## Gemma 系列
- **gemma-1.1-7b-it.q4_K_M**
- **codegemma-1.1-7b-it.q4_K_M**
- **gemma-1.1-2b-it.q4_K_M**

## Dolphin 系列
- **dolphin-2_6-phi-2.q4_K_M**

## Granite 系列
- **granite-3b-code-instruct.q4_K_M**
- **granite-8b-code-instruct.q4_K_M**

# 使用方法
安装 package.json 中定义的依赖库后，执行 node index.js 启动程序
```curl
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
- **默认值**: 空字符串 `''`
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

## `COMMON_PROTO`
- **描述**: 通用 gRPC 服务的 proto 文件路径。
- **默认值**: `'./VertexInferenceService.proto'`

## `GPT_PROTO`
- **描述**: GPT 推理 gRPC 服务的 proto 文件路径。
- **默认值**: `'./GPTInferenceService.proto'`

