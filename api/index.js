import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { AutoRouter, cors, error, json } from 'itty-router';
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServerAdapter } from '@whatwg-node/server';
import { createServer } from 'http';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));

// 配置类
class Config {
    constructor() {
        this.API_PREFIX = process.env.API_PREFIX || '/';
        this.API_KEY = process.env.API_KEY || '';
        this.MAX_RETRY_COUNT = parseInt(process.env.MAX_RETRY_COUNT, 10) || 3;
        this.RETRY_DELAY = parseInt(process.env.RETRY_DELAY, 10) || 5000;
        this.COMMON_GRPC = 'runtime-native-io-vertex-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
        this.COMMON_PROTO = path.join(__dirname, '..', 'protos', 'VertexInferenceService.proto');
        this.GPT_GRPC = 'runtime-native-io-gpt-inference-grpc-service-lmuw6mcn3q-ul.a.run.app';
        this.GPT_PROTO = path.join(__dirname, '..', 'protos', 'GPTInferenceService.proto');
        this.PORT = process.env.PORT || 8787;
    }
}
const config = new Config();

// gRPC处理类
class GRPCHandler {
    constructor(protoFilePath) {
        this.packageDefinition = protoLoader.loadSync(protoFilePath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
    }
}

// CORS和认证中间件
const { preflight, corsify } = cors({
    origin: '*',
    allowMethods: '*',
    exposeHeaders: '*',
});

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

// 日志记录中间件
const logger = (res, req) => {
    console.log(req.method, res.status, req.url, Date.now() - req.start, 'ms');
};

// 路由配置
const router = AutoRouter({
    before: [preflight, withAuth],
    missing: () => error(404, '404 not found.'),
    finally: [corsify, logger],
});

// API端点
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

// 模型转换函数
function convertModel(inputModel) {
    const modelMap = {
        'claude-3-5-sonnet-20240620': 'claude-3-5-sonnet@20240620',
        'claude-3-haiku-20240307': 'claude-3-haiku@20240307',
        'claude-3-sonnet-20240229': 'claude-3-sonnet@20240229',
        'claude-3-opus-20240229': 'claude-3-opus@20240229',
        'gpt-4o-mini': 'gpt-4o-mini',
        'gpt-4o': 'gpt-4o',
        'gpt-4-turbo': 'gpt-4-turbo',
        'gpt-4': 'gpt-4',
        'gpt-3.5-turbo': 'gpt-3.5-turbo',
        'gemini-1.5-flash': 'gemini-1.5-flash',
        'gemini-1.5-pro': 'gemini-1.5-pro',
        'chat-bison': 'chat-bison',
        'codechat-bison': 'codechat-bison',
    };
    return modelMap[inputModel.toLowerCase()] || inputModel;
}

// 完成处理函数
async function handleCompletion(request) {
    try {
        const { model: inputModel, messages, stream: inputStream, temperature, top_p } = await request.json();
        if (!inputModel) {
            console.error("Model parameter is missing in the request");
            return json({ error: { message: 'Model parameter is missing', type: 'invalid_request_error', param: 'model', code: 'missing_model' } }, { status: 400 });
        }
        const stream = inputStream !== undefined ? inputStream : false;
        const model = convertModel(inputModel);
        console.log("Processing request with model:", model, "\nMessages:", messages, "\nStream:", stream);

        const { rules, message: content } = await messagesProcess(messages);
        const response = await GrpcToPieces(model, content, rules, stream, temperature, top_p);

        if (stream) {
            return response;
        } else {
            try {
                const jsonResponse = await response.json();
                if (jsonResponse && jsonResponse.model) {
                    jsonResponse.model = jsonResponse.model.replace('@', '-');
                }
                return jsonResponse;
            } catch (err) {
                console.error("Error parsing response:", err.message);
                return json({ error: { message: 'Error parsing response', type: 'server_error', code: 'parse_error' } }, { status: 500 });
            }
        }
    } catch (err) {
        console.error("Error in handleCompletion:", err.message);
        return json({ error: { message: err.message, type: 'server_error', code: 'internal_error' } }, { status: 500 });
    }
}

// gRPC请求处理函数
async function GrpcToPieces(models, message, rules, stream, temperature, top_p) {
    const credentials = grpc.credentials.createSsl();
    let client, request;

    try {
        if (models.includes('gpt')) {
            const packageDefinition = new GRPCHandler(config.GPT_PROTO).packageDefinition;
            request = { models, messages: [{ role: 0, message: rules }, { role: 1, message }], temperature: temperature || 0.1, top_p: top_p ?? 1 };
            const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.gpt;
            client = new GRPCobjects.GPTInferenceService(config.GPT_GRPC, credentials);
        } else {
            const packageDefinition = new GRPCHandler(config.COMMON_PROTO).packageDefinition;
            request = { models, args: { messages: { unknown: 1, message }, rules } };
            const GRPCobjects = grpc.loadPackageDefinition(packageDefinition).runtime.aot.machine_learning.parents.vertex;
            client = new GRPCobjects.VertexInferenceService(config.COMMON_GRPC, credentials);
        }
        return await ConvertOpenai(client, request, models, stream);
    } catch (err) {
        console.error("Error in GrpcToPieces:", err.message);
        throw new Error(`GrpcToPieces failed: ${err.message}`);
    }
}

// 消息处理函数
async function messagesProcess(messages) {
    let rules = '';
    let message = '';
    for (const msg of messages) {
        const role = msg.role;
        const contentStr = Array.isArray(msg.content) ? msg.content.filter((item) => item.text).map((item) => item.text).join('') || '' : msg.content;
        if (role === 'system') rules += `system:${contentStr};\r\n`;
        else if (['user', 'assistant'].includes(role)) message += `${role}:${contentStr};\r\n`;
    }
    console.log("Processed messages:", { rules, message });
    return { rules, message };
}

// gRPC转换函数
async function ConvertOpenai(client, request, model, stream) {
    for (let i = 0; i < config.MAX_RETRY_COUNT; i++) {
        try {
            if (stream) {
                console.log("开始流处理..."); // 调试输出开始流
                const call = client.PredictWithStream(request);
                const encoder = new TextEncoder();
                const ReturnStream = new ReadableStream({
                    start(controller) {
                        call.on('data', (response) => {
                            const response_code = Number(response.response_code);
                        //     console.log("接收到流数据块，响应代码：", response_code); // 调试数据块接收
                            if (response_code === 204) {
                                console.log("收到204响应代码，关闭流。");
                                controller.close(); // 流正常结束
                                call.destroy(); // 关闭流
                            } else if (response_code === 200) {
                                const response_message = model.includes('gpt') 
                                    ? response.body.message_warpper.message.message 
                                    : response.args.args.args.message;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(ChatCompletionStreamWithModel(response_message, model))}\n\n`));
                            } else {
                                console.error("Stream error:", `Response code: ${response_code}`);
                                controller.error(new Error(`Error: stream chunk is not successful with response code: ${response_code}`));
                            }
                        });

                        call.on('end', () => {
                            console.log("流处理结束."); // 调试输出流结束
                            controller.enqueue(encoder.encode("data: [DONE]\n\n")); // 发送结束信号
                            controller.close(); // 关闭流
                        });

                        call.on('error', (error) => {
                            console.error("Stream error:", error.message);
                            controller.error(new Error(`Stream error: ${error.message}`));
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
                    const response_message = model.includes('gpt') 
                        ? call.body.message_warpper.message.message 
                        : call.args.args.args.message;
                    return new Response(JSON.stringify(ChatCompletionWithModel(response_message, model)), { headers: { 'Content-Type': 'application/json' } });
                } else {
                    throw new Error(`Unexpected response code: ${response_code}`);
                }
            }
        } catch (err) {
            console.error(`Error in ConvertOpenai attempt ${i + 1}:`, err.message);
            await new Promise((resolve) => setTimeout(resolve, config.RETRY_DELAY)); // 等待重试
        }
    }
    return error(500, 'Maximum retry count reached');
}


    

// 构建完成响应
function ChatCompletionWithModel(message, model) {
    return {
        id: 'Chat-Nekohy',
        object: 'chat.completion',
        created: Date.now(),
        model,
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        choices: [{ message: { content: message, role: 'assistant' }, index: 0 }],
    };
}

// 流响应构建
function ChatCompletionStreamWithModel(text, model) {
    return {
        id: 'chatcmpl-Nekohy',
        object: 'chat.completion.chunk',
        created: 0,
        model,
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    };
}

// 启动HTTP服务器
(async () => {
    if (typeof addEventListener === 'function') return;
    const ittyServer = createServerAdapter(router.fetch);
    console.log(`Listening on http://localhost:${config.PORT}`);
    const httpServer = createServer(ittyServer);
    httpServer.listen(config.PORT);
})();
