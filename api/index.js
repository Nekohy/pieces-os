import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { AutoRouter, cors, error, json } from 'itty-router';
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServerAdapter } from '@whatwg-node/server';
import { createServer } from 'http';

// 加载环境变量
dotenv.config();
// 获取当前文件的目录路径（ESM 方式）
const __dirname = dirname(fileURLToPath(import.meta.url));
// 初始化配置
class Config {
    constructor() {
        this.API_PREFIX = process.env.API_PREFIX || '/';
        this.API_KEY = process.env.API_KEY || '';
        this.MAX_RETRY_COUNT = process.env.MAX_RETRY_COUNT || 3;
        this.RETRY_DELAY = process.env.RETRY_DELAY || 5000;
        this.COMMON_GRPC = 'runtime-native-io-vertex-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
        this.COMMON_PROTO = path.join(__dirname, '..', 'protos', 'VertexInferenceService.proto');
        this.GPT_GRPC = 'runtime-native-io-gpt-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
        this.GPT_PROTO = path.join(__dirname, '..', 'protos', 'GPTInferenceService.proto');
        this.PORT = process.env.PORT || 8787;
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
            oneofs: true,
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
// 返回运行信息
const logger = (res, req) => {
    console.log(req.method, res.status, req.url, Date.now() - req.start, 'ms');
};
const router = AutoRouter({
    before: [preflight, withAuth],
    missing: () => error(404, '404 not found.'),
    finally: [corsify, logger],
});
// Router路径
router.get('/', () => json({ message: 'API 服务运行中~' }));
router.get('/ping', () => json({ message: 'pong' }));
router.get(config.API_PREFIX + '/v1/models', () =>
    json({
        object: 'list',
        data: [
            { id: 'gpt-4o-mini', object: 'model', owned_by: 'pieces-os' },
            { id: 'gpt-4o', object: 'model', owned_by: 'pieces-os' },
            { id: 'gpt-4-turbo', object: 'model', owned_by: 'pieces-os' },
            { id: 'gpt-4', object: 'model', owned_by: 'pieces-os' },
            { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'pieces-os' },
            { id: 'claude-3-sonnet@20240229', object: 'model', owned_by: 'pieces-os' },
            { id: 'claude-3-opus@20240229', object: 'model', owned_by: 'pieces-os' },
            { id: 'claude-3-haiku@20240307', object: 'model', owned_by: 'pieces-os' },
            { id: 'claude-3-5-sonnet@20240620', object: 'model', owned_by: 'pieces-os' },
            { id: 'gemini-1.5-flash', object: 'model', owned_by: 'pieces-os' },
            { id: 'gemini-1.5-pro', object: 'model', owned_by: 'pieces-os' },
            { id: 'chat-bison', object: 'model', owned_by: 'pieces-os' },
            { id: 'codechat-bison', object: 'model', owned_by: 'pieces-os' },
        ],
    })
);
router.post(config.API_PREFIX + '/v1/chat/completions', (req) => handleCompletion(req));

// 调用模型转换函数
function convertModel(inputModel) {
    let model;
    switch (inputModel.toLowerCase()) {
        case 'claude-3-5-sonnet@20240620':
            model = 'claude-3-5-sonnet-20240620';
            break;
        case 'claude-3-haiku@20240307':
            model = 'claude-3-haiku-20240307';
            break;
        case 'claude-3-sonnet@20240229':
            model = 'claude-3-sonnet-20240229';
            break;
        case 'claude-3-opus@20240229':
            model = 'claude-3-opus-20240229';
            break;
    }
    return model;
}

async function handleCompletion(request) {
    try {
        const { model: inputModel, messages, stream, temperature, top_p } = await request.json();
        console.log('Model:', inputModel, 'Messages:', messages, 'Stream:', stream);

        // 解析 system 和 user/assistant 消息
        const { rules, message: content } = await messagesProcess(messages);
        console.log('Parsed Rules:', rules, 'Parsed Content:', content);

        // 调用 GrpcToPieces 并返回响应
        const response = await GrpcToPieces(inputModel, content, rules, stream, temperature, top_p);
        return response;
    } catch (err) {
        console.error('Error in handleCompletion:', err.message);
        return error(500, err.message);
    }
}

async function GrpcToPieces(model, message, rules, stream, temperature, top_p) {
    const credentials = grpc.credentials.createSsl();
    let client, request;

    try {
        if (model.includes('gpt')) {
            const packageDefinition = new GRPCHandler(config.GPT_PROTO).packageDefinition;
            request = {
                models: model,
                messages: [
                    { role: 0, message: rules },
                    { role: 1, message: message },
                ],
                temperature: temperature || 0.1,
                top_p: top_p ?? 1,
            };
            const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.gpt;
            client = new GRPCobjects.GPTInferenceService(config.GPT_GRPC, credentials);
        } else {
            const packageDefinition = new GRPCHandler(config.COMMON_PROTO).packageDefinition;
            request = {
                models: model,
                args: {
                    messages: {
                        unknown: 1,
                        message,
                    },
                    rules,
                },
            };
            const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.vertex;
            client = new GRPCobjects.VertexInferenceService(config.COMMON_GRPC, credentials);
        }

        // Debugging information for request
        console.log('Request:', request);

        // 在请求中保持原始模型名称，并在响应中进行转换
        return await ConvertOpenai(client, request, model, stream);
    } catch (err) {
        console.error('Error in GrpcToPieces:', err.message);
        throw new Error(`GrpcToPieces failed: ${err.message}`);
    }
}

// 定义 messagesProcess 函数，解析传入的消息并返回规则和内容
async function messagesProcess(messages) {
    let rules = '';
    let message = '';

    for (const msg of messages) {
        const role = msg.role;
        const contentStr = Array.isArray(msg.content)
            ? msg.content.filter((item) => item.text).map((item) => item.text).join('') || ''
            : msg.content;
        if (role === 'system') {
            rules += `system:${contentStr};\r\n`;
        } else if (['user', 'assistant'].includes(role)) {
            message += `${role}:${contentStr};\r\n`;
        }
    }
    return { rules, message };
}

async function ConvertOpenai(client, request, model, stream) {
    const convertedModel = convertModel(model); // 将模型转换为符合规范的格式

    for (let i = 0; i < config.MAX_RETRY_COUNT; i++) {
        try {
            if (stream) {
                const call = client.PredictWithStream(request);
                const encoder = new TextEncoder();
                const ReturnStream = new ReadableStream({
                    start(controller) {
                        call.on('data', (response) => {
                            const response_code = Number(response.response_code);
                            if (response_code === 204) {
                                controller.close();
                                call.destroy();
                            } else if (response_code === 200) {
                                const response_message = convertedModel.includes('gpt')
                                    ? response.body.message_warpper.message.message
                                    : response.args.args.args.message;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(ChatCompletionStreamWithModel(response_message, convertedModel))}\n\n`));
                            } else {
                                controller.error(new Error(`Error: stream chunk is not successful with response code: ${response_code}`));
                                controller.close();
                            }
                        });
                    },
                });
                return new Response(ReturnStream, { headers: { 'Content-Type': 'text/event-stream' } });
            } else {
                const call = await new Promise((resolve, reject) => {
                    client.Predict(request, (err, response) => {
                        if (err) reject(new Error(`gRPC Predict error: ${err.message}`));
                        else resolve(response);
                    });
                });
                const response_code = Number(call.response_code);
                if (response_code === 200) {
                    const response_message = convertedModel.includes('gpt')
                        ? call.body.message_warpper.message.message
                        : call.args.args.args.message;
                    return new Response(JSON.stringify(ChatCompletionWithModel(response_message, convertedModel)), { headers: { 'Content-Type': 'application/json' } });
                } else {
                    throw new Error(`Unexpected response code: ${response_code}`);
                }
            }
        } catch (err) {
            console.error(`Error in ConvertOpenai attempt ${i + 1}:`, err.message);
            await new Promise((resolve) => setTimeout(resolve, config.RETRY_DELAY));
        }
    }
    return error(500, 'Maximum retry count reached');
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

(async () => {
    if (typeof addEventListener === 'function') return;
    const ittyServer = createServerAdapter(router.fetch);
    console.log(`Listening on http://localhost:${config.PORT}`);
    const httpServer = createServer(ittyServer);
    httpServer.listen(config.PORT);
})();
