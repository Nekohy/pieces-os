import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import {AutoRouter, cors, error, json} from 'itty-router';
import dotenv from 'dotenv';
import path,{ dirname } from 'path';
import { fileURLToPath } from 'url';
import {createServerAdapter} from '@whatwg-node/server';
import {createServer} from 'http';
import swaggerJsdoc from 'swagger-jsdoc';
// 加载环境变量
dotenv.config();
// Swagger配置
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '聊天接口文档',
            version: '1.0.0',
            description: '这是一个支持多模型的聊天API服务，支持GPT、Claude、Gemini等多种模型。',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 8787}`,
                description: '开发环境服务器',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    description: '请在此输入您的API密钥',
                },
            },
        },
        tags: [
            {
                name: '模型管理',
                description: '获取可用的AI模型信息'
            },
            {
                name: '聊天功能',
                description: '与AI模型进行对话'
            }
        ]
    },
    apis: ['./api/index.js'],
};

// 生成swagger规范
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// 获取当前文件的目录路径（ESM 方式）
const __dirname = dirname(fileURLToPath(import.meta.url));
// 初始化配置

// 初始化配置
class Config {
        constructor() {
                this.API_PREFIX = process.env.API_PREFIX || '/';
                this.API_KEY = process.env.API_KEY || '';
                this.MAX_RETRY_COUNT = process.env.MAX_RETRY_COUNT || 3;
                this.RETRY_DELAY = process.env.RETRY_DELAY || 5000;
                this.COMMON_GRPC = 'runtime-native-io-vertex-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
                this.COMMON_PROTO = path.join(__dirname,'..', 'protos', 'VertexInferenceService.proto')
                this.GPT_GRPC = 'runtime-native-io-gpt-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
                this.GPT_PROTO = path.join(__dirname,'..', 'protos', 'GPTInferenceService.proto')
                this.PORT = process.env.PORT || 8787;
                // 添加支持的模型列表
                this.SUPPORTED_MODELS = [
                    "gpt-4o-mini",
                    "gpt-4o",
                    "gpt-4-turbo",
                    "gpt-4",
                    "gpt-3.5-turbo",
                    "claude-3-sonnet@20240229",
                    "claude-3-opus@20240229",
                    "claude-3-haiku@20240307",
                    "claude-3-5-sonnet@20240620",
                    "gemini-1.5-flash",
                    "gemini-1.5-pro",
                    "chat-bison",
                    "codechat-bison"
                ];
        }

        // 添加模型验证方法
        isValidModel(model) {
                // 处理 Claude 模型的特殊格式
                const RegexInput = /^(claude-3-(5-sonnet|haiku|sonnet|opus))-(\d{8})$/;
                const matchInput = model.match(RegexInput);
                const normalizedModel = matchInput ? `${matchInput[1]}@${matchInput[3]}` : model;

                return this.SUPPORTED_MODELS.includes(normalizedModel);
        }
}

class GRPCHandler {
        constructor(protoFilePath) {
                // 动态加载传入的 .proto 文件路径
                this.packageDefinition = protoLoader.loadSync(protoFilePath, {
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true
                });
        }
}
const config = new Config();
// 中间件
// 添加运行回源
const { preflight, corsify } = cors({
	origin: '*',
	allowMethods: '*',
	exposeHeaders: '*',
});
// 添加请求时间中间件
const withRequestTime = (request) => {
    request.startTime = Date.now();
};
// 添加认证
const withAuth = (request) => {
	if (config.API_KEY) {
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return error(401, 'Unauthorized: Missing or invalid Authorization header');
		}
		const token = authHeader.substring(7);
		if (token !== config.API_KEY) {
			return error(403, 'Forbidden: Invalid API key');
		}
	}
};
// 更新日志中间件
const logger = (res, req) => {
    const endTime = Date.now();
    const duration = endTime - (req.startTime || endTime);
    console.log(req.method, res.status, req.url, duration, 'ms');
};
// 更新路由配置
const router = AutoRouter({
    before: [preflight, withRequestTime, withAuth], // 添加 withRequestTime 到 before 中间件
    missing: () => error(404, '404 not found.'),
    finally: [corsify, logger],
});
// Router路径
router.get('/api-docs', () => {
    return new Response(
        `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <title>API 文档</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
            <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js"></script>
            <style>
                .swagger-ui .topbar { display: none }
                .swagger-ui .info .title small.version-stamp { background-color: #222 }
                .swagger-ui .info .title { font-family: "Microsoft YaHei", "微软雅黑", sans-serif }
                .swagger-ui { font-family: "Microsoft YaHei", "微软雅黑", sans-serif !important }
            </style>
        </head>
        <body>
            <div id="swagger-ui"></div>
            <script>
                window.onload = () => {
                    window.ui = SwaggerUIBundle({
                        url: '/api-docs/swagger.json',
                        dom_id: '#swagger-ui',
                        defaultModelsExpandDepth: -1,
                        docExpansion: 'list',
                        deepLinking: true,
                        presets: [
                            SwaggerUIBundle.presets.apis,
                            SwaggerUIBundle.SwaggerUIStandalonePreset
                        ],
                        layout: "BaseLayout",
                        requestInterceptor: (req) => {
                            // 如果是JSON请求体，确保内容类型正确
                            if (req.body) {
                                req.headers['Content-Type'] = 'application/json';
                            }
                            return req;
                        }
                    });
                };
            </script>
        </body>
        </html>
        `,
        {
            headers: {
                'content-type': 'text/html;charset=UTF-8',
            },
        }
    );
});

router.get('/api-docs/swagger.json', () => {
    return new Response(JSON.stringify(swaggerSpec), {
        headers: {
            'content-type': 'application/json',
        },
    });
});

router.get('/', () => json({ message: 'API 服务运行中~' }));
router.get('/ping', () => json({ message: 'pong' }));
/**
 * @openapi
 * /v1/models:
 *   get:
 *     tags:
 *       - 模型管理
 *     summary: 获取可用模型列表
 *     description: 返回所有当前支持的AI模型列表，包括GPT、Claude和Gemini等
 *     responses:
 *       200:
 *         description: 成功返回模型列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 object:
 *                   type: string
 *                   description: 返回对象类型
 *                   example: list
 *                 data:
 *                   type: array
 *                   description: 模型列表
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: 模型标识符
 *                         example: gpt-4
 *                       object:
 *                         type: string
 *                         description: 对象类型
 *                         example: model
 *                       owned_by:
 *                         type: string
 *                         description: 模型所有者
 *                         example: pieces-os
 */
router.get(config.API_PREFIX + '/v1/models', () =>
    json({
            object: 'list',
            data: [
                    { id: "gpt-4o-mini", object: "model", owned_by: "pieces-os" },
                    { id: "gpt-4o", object: "model", owned_by: "pieces-os" },
                    { id: "gpt-4-turbo", object: "model", owned_by: "pieces-os" },
                    { id: "gpt-4", object: "model", owned_by: "pieces-os" },
                    { id: "gpt-3.5-turbo", object: "model", owned_by: "pieces-os" },
                    { id: "claude-3-sonnet@20240229", object: "model", owned_by: "pieces-os" },
                    { id: "claude-3-opus@20240229", object: "model", owned_by: "pieces-os" },
                    { id: "claude-3-haiku@20240307", object: "model", owned_by: "pieces-os" },
                    { id: "claude-3-5-sonnet@20240620", object: "model", owned_by: "pieces-os" },
                    { id: "gemini-1.5-flash", object: "model", owned_by: "pieces-os" },
                    { id: "gemini-1.5-pro", object: "model", owned_by: "pieces-os" },
                    { id: "chat-bison", object: "model", owned_by: "pieces-os" },
                    { id: "codechat-bison", object: "model", owned_by: "pieces-os" },
            ],
    })
);
/**
 * @openapi
 * /v1/chat/completions:
 *   post:
 *     tags:
 *       - 聊天功能
 *     summary: 创建聊天对话
 *     description: |
 *       发送消息给AI模型并获取回复。
 *       支持流式输出和普通输出两种模式。
 *       可以通过temperature和top_p参数调整回复的创造性。
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - messages
 *             properties:
 *               model:
 *                 type: string
 *                 description: |
 *                   选择要使用的模型
 *                   支持的模型包括：
 *                   - GPT系列：gpt-4, gpt-4-turbo, gpt-3.5-turbo 等
 *                   - Claude系列：claude-3-opus@20240229, claude-3-sonnet@20240229 等
 *                   - 其他：gemini-1.5-pro, chat-bison 等
 *                 example: gpt-4
 *               messages:
 *                 type: array
 *                 description: 对话消息列表
 *                 items:
 *                   type: object
 *                   required:
 *                     - role
 *                     - content
 *                   properties:
 *                     role:
 *                       type: user
 *                       description: 消息角色（system系统提示/user用户/assistant助手）
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: hello
 *                       description: 消息内容
 *               stream:
 *                 type: boolean
 *                 description: 是否使用流式输出
 *                 default: false
 *               temperature:
 *                 type: number
 *                 description: 温度参数(0-2)，越高回复越具有创造性，越低回复越稳定
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0.7
 *               top_p:
 *                 type: number
 *                 description: 核采样参数(0-1)，控制回复的多样性
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 1
 *     responses:
 *       200:
 *         description: 成功获取回复
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: 对话ID
 *                 object:
 *                   type: string
 *                   description: 对象类型
 *                 created:
 *                   type: number
 *                   description: 创建时间戳
 *                 model:
 *                   type: string
 *                   description: 使用的模型
 *                 choices:
 *                   type: array
 *                   description: 回复选项
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                             description: 回复角色
 *                           content:
 *                             type: string
 *                             description: 回复内容
 *                       index:
 *                         type: number
 *                         description: 选项索引
 *       401:
 *         description: 认证失败 - API密钥无效或未提供
 *       404:
 *         description: 请求的模型不存在或不可用
 *       500:
 *         description: 服务器内部错误
 */
router.post(config.API_PREFIX + '/v1/chat/completions', (req) => handleCompletion(req));

async function GrpcToPieces(inputModel,OriginModel,message, rules, stream, temperature, top_p) {
        // 在非GPT类型的模型中，temperature和top_p是无效的
        // 使用系统的根证书
        const credentials = grpc.credentials.createSsl();
        let client,request;
        if (inputModel.includes('gpt')){
                // 加载proto文件
                const packageDefinition = new GRPCHandler(config.GPT_PROTO).packageDefinition;
                // 构建请求消息
                request = {
                        models: inputModel,
                        messages: [
                                {role: 0, message: rules}, // system
                                {role: 1, message: message} // user
                        ],
                        temperature:temperature || 0.7,
                        top_p:top_p ?? 1,
                }
                // 获取gRPC对象
                const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.gpt;
                client = new GRPCobjects.GPTInferenceService(config.GPT_GRPC, credentials);
        } else {
                // 加载proto文件
                const packageDefinition = new GRPCHandler(config.COMMON_PROTO).packageDefinition;
                // 构建请求消息
                request = {
                        models: inputModel,
                        args: {
                                messages: {
                                        unknown: 1,
                                        message: message
                                },
                                rules: rules
                        }
                };
                // 获取gRPC对象
                const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.vertex;
                client = new GRPCobjects.VertexInferenceService(config.COMMON_GRPC, credentials);
        }
        return await ConvertOpenai(client,request,inputModel,OriginModel,stream);
}

async function messagesProcess(messages) {
        let rules = '';
        let message = '';

        for (const msg of messages) {
                let role = msg.role;
                // 格式化为字符串
                const contentStr = Array.isArray(msg.content)
                    ? msg.content
                    .filter((item) => item.text)
                    .map((item) => item.text)
                    .join('') || ''
                    : msg.content;
                // 判断身份
                if (role === 'system') {
                        rules += `system:${contentStr};\r\n`;
                } else if (['user', 'assistant'].includes(role)) {
                        message += `${role}:${contentStr};\r\n`;
                }
        }

        return { rules, message };
}

async function ConvertOpenai(client, request, inputModel, OriginModel, stream) {
    for (let i = 0; i < config.MAX_RETRY_COUNT; i++) {
        try {
            if (stream) {
                const call = client.PredictWithStream(request);
                const encoder = new TextEncoder();
                const ReturnStream = new ReadableStream({
                    start(controller) {
                        // 处理数据
                        call.on('data', (response) => {
                            try {
                                let response_code = Number(response.response_code);
                                if (response_code === 204) {
                                    controller.close();
                                    call.destroy();
                                } else if (response_code === 200) {
                                    let response_message;
                                    if (inputModel.includes('gpt')) {
                                        response_message = response.body.message_warpper.message.message;
                                    } else {
                                        response_message = response.args.args.args.message;
                                    }
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(ChatCompletionStreamWithModel(response_message, OriginModel))}\n\n`));
                                } else {
                                    throw new Error(`Invalid response code: ${response_code}`);
                                }
                            } catch (error) {
                                console.error('Error processing stream data:', error);
                                controller.error(error);
                            }
                        });

                        // 处理错误
                        call.on('error', (error) => {
                            console.error('Stream error:', error);
                            // 如果是 INTERNAL 错误且包含 RST_STREAM，可能是正常的流结束
                            if (error.code === 13 && error.details.includes('RST_STREAM')) {
                                controller.close();
                            } else {
                                controller.error(error);
                            }
                            call.destroy();
                        });

                        // 处理结束
                        call.on('end', () => {
                            controller.close();
                        });

                        // 处理取消
                        return () => {
                            call.destroy();
                        };
                    }
                });

                return new Response(ReturnStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache',
                        'Transfer-Encoding': 'chunked'
                    },
                });
            } else {
                // 非流式调用保持不变
                const call = await new Promise((resolve, reject) => {
                    client.Predict(request, (err, response) => {
                        if (err) reject(err);
                        else resolve(response);
                    });
                });

                let response_code = Number(call.response_code);
                if (response_code === 200) {
                    let response_message;
                    if (inputModel.includes('gpt')) {
                        response_message = call.body.message_warpper.message.message;
                    } else {
                        response_message = call.args.args.args.message;
                    }
                    return new Response(JSON.stringify(ChatCompletionWithModel(response_message, OriginModel)), {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                }
            }
        } catch (err) {
            console.error(`Attempt ${i + 1} failed:`, err);
            if (i === config.MAX_RETRY_COUNT - 1) {
                return new Response(JSON.stringify({
                    error: {
                        message: "An error occurred while processing your request",
                        type: "server_error",
                        code: "internal_error",
                        param: null
                    }
                }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }
            await new Promise((resolve) => setTimeout(resolve, config.RETRY_DELAY));
        }
    }
}

function ChatCompletionWithModel(message, model) {
        return {
                id: 'Chat-Nekohy',
                object: 'chat.completion',
                created: Date.now(),
                model,
                usage: {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                },
                choices: [
                        {
                                message: {
                                        content: message,
                                        role: 'assistant',
                                },
                                index: 0,
                        },
                ],
        };
}

function ChatCompletionStreamWithModel(text, model) {
        return {
                id: 'chatcmpl-Nekohy',
                object: 'chat.completion.chunk',
                created: 0,
                model,
                choices: [
                        {
                                index: 0,
                                delta: {
                                        content: text,
                                },
                                finish_reason: null,
                        },
                ],
        };
}

async function handleCompletion(request) {
        try {
                // todo stream逆向接口
                // 解析openai格式API请求
                const { model: OriginModel, messages, stream,temperature,top_p} = await request.json();
                // 添加模型验证
                if (!config.isValidModel(OriginModel)) {
                        return new Response(
                            JSON.stringify({
                                error: {
                                    message: `Model '${OriginModel}' does not exist`,
                                    type: "invalid_request_error",
                                    param: "model",
                                    code: "model_not_found"
                                }
                            }),
                            {
                                status: 404,
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                }
                const RegexInput = /^(claude-3-(5-sonnet|haiku|sonnet|opus))-(\d{8})$/;
                const matchInput = OriginModel.match(RegexInput);
                const inputModel = matchInput ? `${matchInput[1]}@${matchInput[3]}` : OriginModel;

                console.log(`Model: ${OriginModel}\nMessages: ${JSON.stringify(messages, null, 2)}\nStream ${stream ? 'Stream' : 'false'}`);

                // 解析system和user/assistant消息
                const { rules, message:content } = await messagesProcess(messages);
                console.log(rules,content)
                // 响应码，回复的消息
                return await GrpcToPieces(inputModel,OriginModel,content, rules, stream, temperature, top_p);
        } catch (err) {
                return error(500, err.message);
        }
}

(async () => {
    if (typeof addEventListener === 'function') return;

    const app = createServerAdapter(router.fetch);
    const httpServer = createServer(app);

    console.log(`API Server listening on http://localhost:${config.PORT}`);
    console.log(`API Documentation available on http://localhost:${config.PORT}/api-docs`);

    httpServer.listen(config.PORT);
})();
